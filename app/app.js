var app = angular.module('FlashcardApp', ['ngRoute', 'firebase']);

app.constant('FBURL', 'https://quizlet-flashcards.firebaseio.com');

app.run(["$rootScope", "$location", function($rootScope, $location) {
  $rootScope.$on("$routeChangeError", function(event, next, previous, error) {
    // We can catch the error thrown when the $requireAuth promise is rejected
    // and redirect the user back to the home page
    if (error === "AUTH_REQUIRED") {
      $location.path("/");
    }
  });
}]);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'app/components/index/indexView.html',
      controller: 'IndexCtrl'
    })
    .when('/main', {
      templateUrl: 'app/components/main/mainView.html',
      controller: 'MainCtrl',
      resolve: {
        'currentAuth': ['Auth', function(Auth) {
          return Auth.$requireAuth();
        }]
      }
    })
    .when('/create', {
      templateUrl: 'app/components/create/createView.html',
      controller: 'CreateCtrl',
      resolve: {
        'currentAuth': ['Auth', function(Auth) {
          return Auth.$requireAuth();
        }]
      }
    })
    .otherwise({
      redirectTo: '/'
    });
}]);

/**
* All the props and methods relating to firebase authentication
*/
app.factory('Auth', ['$firebaseAuth', 'FBURL',
  function($firebaseAuth, FBURL) {
    var ref = new Firebase(FBURL);
    return $firebaseAuth(ref);
}]);

app.factory('User', ['FBURL', '$firebaseObject',
  function(FBURL, $firebaseObject) {
    var ref = new Firebase(FBURL + '/users');
    var userData = {};
    return {
      setUser: function(authData) {
        ref.child(authData.uid).once('value', function(snapshot) {
          if(snapshot.exists()) {
            userData = $firebaseObject(ref.child(authData.uid));
          } else {
            userData = {
              email: authData.google.email,
              avatar: authData.google.profileImageURL,
              account: 'student'
            }
            console.log('new user');
            ref.child(authData.uid).set(userData);
          }
        });
        return userData;
      },
      getUser: function() {
        return userData;
      }
    }
}]);

app.service('FlashcardService', ['FBURL', '$firebaseArray',
  function(FBURL, $firebaseArray) {
    var ref = new Firebase(FBURL);

    this.getStudentCards = function() {
      return $firebaseArray(ref.child('/studentcards'));
    }

    this.getTeacherCards = function(user) {
      return $firebaseArray(ref.child('/teachercards/' + user));
    }
}]);

/**
* Custom directive dealing with flashcards and how to flip them
* TODO: Separate the HTML into a template
* TODO: Change to an element that can be reused in various parts of the app
*/
app.directive('cardFlip', [function() {
  return {
    restrict: 'A',
    scope: {},
    link: function($scope, element, attrs) {
      element.bind('click', function() {
        element.toggleClass('flipped');
      })
    }
  }
}])

app.controller('IndexCtrl', ['$scope', '$location', 'Auth', 'User',
  function($scope, $location, Auth, User) {
    $scope.auth = Auth;

    $scope.auth.$onAuth(function(authData) {
      if(authData) {
        User.setUser(authData);
        $location.path('/main');
      }

    });

}]);

app.controller('MainCtrl', ['$scope', 'Auth', '$location', 'User', 'FlashcardService',
  function($scope, Auth, $location, User, FlashcardService) {
    $scope.auth = Auth;

    $scope.auth.$onAuth(function(authData) {
      if(authData) {
        $scope.authData = authData;
        $scope.user = User;
        console.log($scope.user.getUser());

        if($scope.user.getUser().account === 'teacher') {
          $scope.flashcards = FlashcardService.getTeacherCards(authData.uid);
        } else {
          $scope.flashcards = FlashcardService.getStudentCards();
        }
      } else {
        $location.path('/');
      }
    });

}]);

app.controller('CreateCtrl', ['$scope', '$location', 'Auth', 'FBURL', 'User',
  function($scope, $location, Auth, FBURL, User) {
    var ref = new Firebase(FBURL);
    $scope.auth = Auth;
    $scope.auth.$onAuth(function(authData) {
      if(authData) {
        $scope.authData = authData;
        $scope.user = User;
      } else {
        $location.path('/');
      }
    })


    $scope.filesChanged = function(elm) {
      $scope.csvFile = elm.files[0];
      $scope.$apply();
    }
    $scope.create = function(title) {

      Papa.parse($scope.csvFile, {
        header: true,
        complete: function(result) {
          filterCSV(title, result.data);    // this whole function needs to come out of the controller
          $location.path('/main');
          $scope.$apply();
        }
      });

      function filterCSV(title, data) {
        var answerObj = data.shift();
        var chartCards = {"title": title, "cards": []};

        //change data in the answer object
        delete answerObj["Username"];
        for(var key in answerObj) {
          if(!answerObj.hasOwnProperty(key)) {
            continue;
          }
          chartCards.cards.push({front: key, back: answerObj[key]});
        }
        ref.child('teachercards').child($scope.authData.uid).push(chartCards);

        for(var i = 0; i < data.length; i++) {
          var cardObj = {};
          if(data[i]["Username"]) {
            cardObj.username = data[i]["Username"];
            delete data[i]["Username"];
            cardObj.questions = [];

            //change data into a front and back card
            for(var key in data[i]) {
              if(!data[i].hasOwnProperty(key)) {
                continue;
              }
              if(data[i][key] == 0) {
                cardObj.questions.push({front: key, back: answerObj[key]});
              } else if(data[i][key] != 1) {
                cardObj.questions.push({front: key, back: data[i][key]});
              }
            }
            ref.child('studentcards').push(cardObj);
            //console.log(answerObj);

          }
        }

      }
    }

}]);
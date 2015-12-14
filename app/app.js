var app = angular.module('FlashcardApp', ['ngRoute', 'firebase']);

app.constant('FBURL', 'https://flashcardmaker.firebaseio.com/');

app.run(["$rootScope", "$location", function($rootScope, $location) {
  $rootScope.$on("$routeChangeError", function(event, next, previous, error) {
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


app.factory('Auth', ['$firebaseAuth', 'FBURL',
  function($firebaseAuth, FBURL) {
    var ref = new Firebase(FBURL);
    return $firebaseAuth(ref);
}]);

app.factory('User', ['Auth', 'FBURL', '$location', '$firebaseObject',
  function(Auth, FBURL, $location, $firebaseObject) {
    var userRef = new Firebase(FBURL + '/users/');

    return {
      setUserData: function(data) {
        var userData = {
          encodedEmail: data.google.email.replace(/(\.)/g, ','),
          email: data.google.email,
          account: 'student',
          displayName: data.google.displayName
        };

        userRef.child(userData.email.replace(/(\.)/g, ',')).set(userData);
      },
      getUserData: function(data) {
        return $firebaseObject(userRef.child(data.google.email.replace(/(\.)/g, ',')));
      }
    };
}]);

app.service('FlashcardService', ['FBURL', '$firebaseArray', '$firebaseObject',
  function(FBURL, $firebaseArray, $firebaseObject) {
    var ref = new Firebase(FBURL);

    this.filterCSV = function (title, data, email) {
      var answerObj = data.shift();
      var chartCards = {"title": title, "allcards": [], "students": []};

      //change data in the answer object
      delete answerObj["Username"];
      for(var key in answerObj) {
        if(!answerObj.hasOwnProperty(key)) {
          continue;
        }
        chartCards.allcards.push({front: key, back: answerObj[key]});
      }


      for(var i = 0; i < data.length; i++) {
        var cardObj = {};
        if(data[i]["Username"]) {
          cardObj.title = title;
          cardObj.username = data[i]["Username"];
          chartCards.students.push(cardObj.username);
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
          // chartCards.studentcards.push(cardObj);
          var studentKey = ref.child('studentDecks/' + cardObj.username.replace(/(\.)/g, ',')).push(cardObj);

          };
        }
      ref.child('teacherDecks/' + email.replace(/(\.)/g, ',')).push(chartCards);
      // ref.child('teachercards').child(uid).push(chartCards);
      // ref.child('studentcards').push(chartCards.studentcards);
      // ref.child('allcards').push({title: chartCards.title, uid: uid, cards: chartCards.allcards});

    }

    this.getStudentCards = function(email) {
      return $firebaseArray(ref.child('studentDecks/' + email));
    }

    this.getTeacherCards = function(email) {
      return $firebaseArray(ref.child('teacherDecks/' + email));
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
}]);

app.directive('navBar', [function() {
  return {
    restrict: 'E',
    templateUrl: 'app/shared/navbarView.html'
  }
}])

app.controller('IndexCtrl', ['$scope', '$location', 'Auth', 'User',
  function($scope, $location, Auth, User) {

    $scope.auth = Auth;

    $scope.auth.$onAuth(function(data) {
      if(data) {
        User.getUserData(data).$loaded().then(function(load) {
          if(!load.account) {
            User.setUserData(data);
          }
          $location.path('/main');
        });
      } else {
        $location.path('/');
        $scope.$apply();
      }
    });

}]);

app.controller('MainCtrl', ['$scope', '$location', 'Auth', 'User', 'FlashcardService',
  function($scope, $location, Auth, User, FlashcardService) {

    $scope.auth = Auth;

    $scope.authData = Auth.$getAuth();

    $scope.userData = User.getUserData($scope.authData);

    $scope.userData.$loaded().then(function(load) {
      if(load.account === 'student') {
        $scope.cards = FlashcardService.getStudentCards(load.encodedEmail);
      } else {
        $scope.cards = FlashcardService.getTeacherCards(load.encodedEmail);
      }
    })

}]);

app.controller('CreateCtrl', ['$scope', '$location', 'Auth', 'FlashcardService',
  function($scope, $location, Auth, FlashcardService) {

    $scope.auth = Auth;
    $scope.authData = Auth.$getAuth();
    $scope.flashcards = {"cards": []};

    $scope.filesChanged = function(elm) {
      $scope.csvFile = elm.files[0];
      $scope.$apply();
    }

    $scope.create = function(title) {
      Papa.parse($scope.csvFile, {
        header: true,
        complete: function(result) {
          FlashcardService.filterCSV(title, result.data, $scope.authData.google.email);
          $location.path('/main');
          $scope.$apply();
        }
      });
    }

    $scope.saveCardPack = function(title, flashcards) {
      flashcards.title = title;
      FlashcardService.setTeacherCards($scope.authData.uid, flashcards);
      $location.path('/main');
    }

}]);

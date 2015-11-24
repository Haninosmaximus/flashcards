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
    .when('/main/:flashcardKey', {
      templateUrl: 'app/components/main/fullCardsView.html',
      controller: 'FlashcardsCtrl',
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
    var userData = {};
    var ref = new Firebase(FBURL + '/users/');

    function authDataCallback(data) {
      if(data) {

        userData = $firebaseObject(ref.child(data.uid));

        userData.$loaded().then(function(response) {
          if(!userData.account) {
            userData.email = data.google.email;
            userData.displayName = data.google.displayName;
            userData.account = 'student';
            userData.$save();
          }
        });

        $location.path('/main');

      } else {
        userData = {};
        console.log('user is logged out');
        $location.path('/');
      }
      return userData;
    }
    Auth.$onAuth(authDataCallback);

    return userData;
}]);

app.factory('UserData', ['$firebaseObject', 'FBURL',
  function($firebaseObject, FBURL) {

    return function(user) {
      var ref = new Firebase(FBURL + '/users/' + user);

      return $firebaseObject(ref);
    }

}])

app.service('FlashcardService', ['FBURL', '$firebaseArray',
  function(FBURL, $firebaseArray) {
    var ref = new Firebase(FBURL);

    this.filterCSV = function (title, data, uid) {
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

      ref.child('teachercards').child(uid).push(chartCards);

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
        }
      }

    }

    this.getStudentCards = function() {
      return $firebaseArray(ref.child('/studentcards'));
    }

    this.getTeacherCards = function(user) {
      return $firebaseArray(ref.child('/teachercards').child(user));
    }

    this.setTeacherCards = function(user, cards) {
      $firebaseArray(ref.child('/teachercards').child(user)).$add(cards);
    }

    this.getCardsByKey = function(user, key) {
      return $firebaseArray(ref.child('/teachercards').child(user).child(key).child('cards'));
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

}]);

app.controller('MainCtrl', ['$scope', '$location', 'Auth', 'UserData', 'FlashcardService',
  function($scope, $location, Auth, UserData, FlashcardService) {

    $scope.auth = Auth;

    $scope.authData = Auth.$getAuth();

    $scope.userData = UserData($scope.authData.uid);

    $scope.userData.$loaded().then(function(response) {
      if($scope.userData.account === 'teacher') {
        $scope.teachercards = FlashcardService.getTeacherCards($scope.authData.uid);
      } else {
        $scope.studentcards = FlashcardService.getStudentCards();
      }
    });

    // $scope.listLink = function(id) {
    //   $location.path('/main/' + id);
    // }

    $scope.listLink = function(id) {
      $scope.studentcards = FlashcardService.getCardsByKey($scope.authData.uid, id);
      console.log($scope.studentcards);
    }
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
          FlashcardService.filterCSV(title, result.data, $scope.authData.uid);    // this whole function needs to come out of the controller
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

app.controller('FlashcardsCtrl', ['$scope', '$routeParams', 'Auth', 'FlashcardService',
  function($scope, $routeParams, Auth, FlashcardService) {

    $scope.auth = Auth;

    $scope.authData = Auth.$getAuth();

    $scope.flashcards = FlashcardService.getCardsByKey($scope.authData.uid, $routeParams.flashcardKey);

}]);
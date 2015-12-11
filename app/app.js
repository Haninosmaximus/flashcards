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
    .when('/register', {
      templateUrl: 'app/components/register/registerView.html',
      controller: 'RegisterCtrl'
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
    var authData = {};

    var ref = new Firebase(FBURL + '/users/');

    function authDataCallback(data) {
      if(data) {
        authData = data;

        ref.child(encodeEmail(data.google.email)).once('value', function(snap) {
          if(snap.exists()) {
            userData = snap.val();
            $location.path('/main');
          } else {
            userData.encodedEmail = encodeEmail(data.google.email);
            $location.path('/register');
          }
        });
      } else {
        userData = {};
        authData = {};
        $location.path('/');
      }
      return userData;
    }

    function encodeEmail(email) {
      return encodeURIComponent(email.replace(/(\.)/g, ','));
    }

    function decodeEmail(email) {
      return decodeURIComponent(email).replace(/(,)/g, '.');
    }

    Auth.$onAuth(authDataCallback);

    return userData;
}]);

app.service('FlashcardService', ['FBURL', '$firebaseArray', '$firebaseObject',
  function(FBURL, $firebaseArray, $firebaseObject) {
    var ref = new Firebase(FBURL);

    this.filterCSV = function (title, data, uid) {
      var answerObj = data.shift();
      var chartCards = {"title": title, "allcards": [], "studentcards": []};

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
          chartCards.studentcards.push(cardObj);
        }

      }
      ref.child('teachercards').child(uid).push(chartCards);
      ref.child('studentcards').push(chartCards.studentcards);
      ref.child('allcards').push({title: chartCards.title, uid: uid, cards: chartCards.allcards});

    }

    this.getStudentCards = function() {
      return $firebaseObject(ref.child('/studentcards'));
    }

    this.getTeacherCards = function(user) {
      return $firebaseArray(ref.child('/teachercards/' + user));
    }

    this.getCardsByKey = function(user, key) {
      return $firebaseArray(ref.child('/teachercards').child(user).child(key).child('cards'));
    }

    this.getAllCards = function() {
      return $firebaseArray(ref.child('allcards'));
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

    $scope.teachercards = FlashcardService.getStudentCards();

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
          FlashcardService.filterCSV(title, result.data, $scope.authData.uid);
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

app.controller('RegisterCtrl', ['$scope', '$location', 'Auth', 'User', 'FBURL', function($scope, $location, Auth, User, FBURL) {

  $scope.authData = Auth.$getAuth();
  console.log($scope.authData);
  $scope.registerUser = function() {

    var userData = User;

    userData.email = $scope.authData.google.email;
    userData.account = $scope.user.account;
    userData.displayName = $scope.authData.google.displayName;

    var ref = new Firebase(FBURL + '/users/' + userData.encodedEmail);
    ref.set(userData);
  }
}]);
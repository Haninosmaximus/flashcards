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
    .when('/create', {
      templateUrl: 'app/components/create/createView.html',
      controller: 'CreateCtrl',
      resolve: {
        'currentAuth': ['fireFactory', function(fireFactory) {
          return fireFactory.getAuth().$requireAuth();
        }]
      }
    })
    .otherwise({
      redirectTo: '/'
    });
}]);


app.factory('fireFactory', ['$firebaseObject', '$firebaseAuth', 'FBURL', function($firebaseObject, $firebaseAuth, FBURL) {
  var ref = new Firebase(FBURL);

  return {
    getAuth: function() {
      return $firebaseAuth(ref);
    },
    getRef: function() {
      return ref;
    },
    getCharts: function() {
      return new Firebase(FBURL + '/charts');
    }
  }
}]);

app.service('userSvc', ['fireFactory', '$firebaseObject', function(fireFactory, $firebaseObject) {

  this.setUser = function(user) {
    var userObj = {
      data: {
        username: user.google.email.split('@')[0],
        displayname: user.google.displayName,
        email: user.google.email,
        picture: user.google.profileImageURL,
        teacher: false
      }
    }
    return fireFactory.getRef().child('users').child(user.uid).set(userObj);
  };

  this.getUser = function(user) {
    var userData = $firebaseObject(fireFactory.getRef().child('users').child(user.uid).child('data'));
    return userData;
  }

  this.inDb = function(user) {
    var exists = $firebaseObject(fireFactory.getRef().child('users').child(user.uid));
    console.log(exists);
    if(exists) {
      return true;
    } else {
      return false;
    }
  }


}])

app.service('flashcardSvc', ['fireFactory','userSvc', '$firebaseArray',
  function(fireFactory, userSvc, $firebaseArray) {
    this.getFlashcards = function(user) {

      return $firebaseArray(fireFactory.getRef().child('charts').child(user.uid));
    }

    this.getPracticeCards = function(user) {
      return $firebaseArray(fireFactory.getRef().child('flashcards')
        .child(user.google.email.split('@')[1].split('.')[0])
        .child(user.google.email.split('@')[0]));
    }
}]);

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

app.controller('IndexCtrl', ['$scope', 'fireFactory', 'userSvc', 'flashcardSvc',
  function($scope, fireFactory, userSvc, flashcardSvc) {
  $scope.auth = fireFactory;

  $scope.auth.getAuth().$onAuth(function(authData) {
    if(authData) {
      var userData = userSvc.getUser(authData);
      userData.$loaded().then(function(resp) {
        console.log(resp);
        if(userData.teacher) {
          $scope.teacher = true;
          $scope.flashcards = flashcardSvc.getFlashcards(authData);
        } else if(!userData.username) {
          userSvc.setUser(authData);
          $scope.flashcards = flashcardSvc.getPracticeCards(authData);
          console.log($scope.flashcards);
        } else {
          $scope.flashcards = flashcardSvc.getPracticeCards(authData);
        }
      });
    } else {
      $scope.teacher = false;
    }
    $scope.authData = authData;
  });

}]);

app.controller('CreateCtrl', ['$scope', '$location', 'fireFactory', function($scope, $location, fireFactory) {
  $scope.fireFactory = fireFactory;
  $scope.fireFactory.getAuth().$onAuth(function(authData) {
    $scope.authData = authData;
  });

  $scope.filesChanged = function(elm) {
    $scope.csvFile = elm.files[0];
    $scope.$apply();
  }
  $scope.create = function() {
    $scope.jsonResult = true;
    Papa.parse($scope.csvFile, {
      header: true,
      complete: function(result) {
        filterCSV(result.data);
        $location.path('/#');
        $scope.$apply();
      }
    });

    function filterCSV(data) {
      var answerObj = data.shift();
      var chartCards = [];

      //change data in the answer object
      delete answerObj["Username"];
      delete answerObj["% Score"];
      delete answerObj["Timestamp"];
      for(var key in answerObj) {
        if(!answerObj.hasOwnProperty(key)) {
          continue;
        }
        chartCards.push({front: key, back: answerObj[key]});
      }
      fireFactory.getRef().child('charts').child($scope.authData.uid).push(chartCards);

      for(var i = 0; i < data.length; i++) {
        var cardObj = {};
        if(data[i]["Username"]) {
          cardObj.domainName = data[i]["Username"].split('@')[1].split('.')[0];
          cardObj.username = data[i]["Username"].split('@')[0];

        cardObj.questions = [];


        //change data into a front and back card
        for(var key in data[i]) {
          if(!data[i].hasOwnProperty(key)) {
            continue;
          }
          if(data[i][key] == 0) {
            cardObj.questions.push({front: key, back: answerObj[key]});
          } else {
            cardObj.questions.push({front: key, back: data[i][key]});
          }
        }
        fireFactory.getRef().child('flashcards').child(cardObj.domainName).child(cardObj.username).push(cardObj.questions);
        //console.log(answerObj);

        }
      }

    }
  }

}])
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
        'currentAuth': ['fireFactory', function(fireFactory) {
          return fireFactory.auth.$requireAuth();
        }]
      }
    })
    .when('/create', {
      templateUrl: 'app/components/create/createView.html',
      controller: 'CreateCtrl',
      resolve: {
        'currentAuth': ['fireFactory', function(fireFactory) {
          return fireFactory.auth.$requireAuth();
        }]
      }
    })
    .when('/:user/quizme', {
      templateUrl: 'app/components/quizme/quizmeView.html',
      controller: 'QuizmeCtrl',
      resolve: {
        'currentAuth': ['fireFactory', function(fireFactory) {
          return fireFactory.auth.$requireAuth();
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
app.factory('fireFactory', ['$firebaseAuth', 'FBURL',
  function($firebaseAuth, FBURL) {
    var ref = new Firebase(FBURL);
    var auth = $firebaseAuth(ref);

    var user = {};
    var authData = {};

    return {
      auth: auth,
      ref: ref,
      user: user,
      authData: authData,
      setUser: function(authData) {
        user.username = authData.google.email.split('@')[0];
        user.account = "student";
        authData = authData;
        ref.child('users').child(authData.uid).set(user);
      },
      logout: function() {
        user = {};
        authData = {};
      }
    };

}])

/**
* All the functions and methods related to pulling cards from firebase
*/
app.service('flashcardSvc', ['fireFactory', '$firebaseArray',
  function(fireFactory, $firebaseArray) {
    this.getFlashcards = function(user) {
      return $firebaseArray(fireFactory.ref.child('charts').child(user.uid));
    }

    this.getPracticeCards = function(user) {
      return $firebaseArray(fireFactory.ref.child('flashcards')
        .child(user.google.email.split('@')[1].split('.')[0])
        .child(user.google.email.split('@')[0]));
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

app.controller('IndexCtrl', ['$scope', '$location', 'fireFactory',
  function($scope, $location, fireFactory) {

    $scope.login = function() {
      fireFactory.auth.$authWithOAuthPopup('google',{scope: 'email'});
    }

    fireFactory.auth.$onAuth(function(authData) {
      if(authData) {
        fireFactory.setUser(authData);
        $location.path('/main');
      }
    });

}]);

app.controller('MainCtrl', ['$scope', 'fireFactory', 'flashcardSvc',
  function($scope, fireFactory, flashcardSvc) {
    $scope.authData = fireFactory.authData;
    console.log($scope.authData);
    $scope.logout = function() {
      fireFactory.auth.$unauth();
      fireFactory.logout();
    }

    fireFactory.auth.$onAuth(function(authData) {
      $scope.authData = fireFactory.authData;
    })
}]);

app.controller('CreateCtrl', ['$scope', '$location', 'fireFactory', function($scope, $location, fireFactory) {
  $scope.fireFactory = fireFactory;
  $scope.fireFactory.auth.$onAuth(function(authData) {
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
        filterCSV(result.data);    // this whole function needs to come out of the controller
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
      fireFactory.ref.child('charts').child($scope.authData.uid).push(chartCards);

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
        fireFactory.ref.child('flashcards').child(cardObj.domainName).child(cardObj.username).push(cardObj.questions);
        //console.log(answerObj);

        }
      }

    }
  }

}]);

app.controller('QuizmeCtrl', ['$scope', 'flashcardSvc', 'fireFactory',
  function($scope, flashcardSvc, fireFactory) {
    //create a view for students to quiz themselves
}]);
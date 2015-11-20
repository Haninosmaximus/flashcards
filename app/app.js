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
        'currentAuth': ['FireFactory', function(FireFactory) {
          return FireFactory.$requireAuth();
        }]
      }
    })
    .when('/create', {
      templateUrl: 'app/components/create/createView.html',
      controller: 'CreateCtrl',
      resolve: {
        'currentAuth': ['FireFactory', function(FireFactory) {
          return FireFactory.$requireAuth();
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
app.factory('FireFactory', ['$firebaseAuth', 'FBURL',
  function($firebaseAuth, FBURL) {
    var ref = new Firebase(FBURL);
    return $firebaseAuth(ref);
}]);

app.factory('User', ['FBURL',
  function(FBURL) {
    var ref = new Firebase(FBURL);
    var user = {};
    return {
      setUser: function(authData) {
        user.username = authData.google.email;
        user.account = "student";
        ref.child('users').child(authData.uid).set(user);
      },
      userInDb: function(user) {
        return false;
      },
      user: user
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

app.controller('IndexCtrl', ['$scope', '$location', 'FireFactory',
  function($scope, $location, FireFactory) {
    $scope.auth = FireFactory;

    // $scope.login = function() {
    //   auth.$authWithOAuthPopup('google',{scope: 'email'});
    // }

    FireFactory.$onAuth(function(authData) {
      $location.path('/main');
    });

}]);

app.controller('MainCtrl', ['$scope', 'FireFactory',
  function($scope, FireFactory) {
    $scope.authData = FireFactory;

}]);

app.controller('CreateCtrl', ['$scope', '$location', 'FireFactory', 'FBURL',
  function($scope, $location, FireFactory, FBURL) {
  var ref = new Firebase(FBURL);

  FireFactory.$onAuth(function(authData) {
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
      ref.child('charts').child($scope.authData.uid).push(chartCards);

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
        ref.child('flashcards').child(cardObj.domainName).child(cardObj.username).push(cardObj.questions);
        //console.log(answerObj);

        }
      }

    }
  }

}]);
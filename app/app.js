var app = angular.module('FlashcardApp', ['ngRoute', 'firebase']);

app.constant('FBURL', 'https://quizlet-flashcards.firebaseio.com');

app.run(["$rootScope", "$location", function($rootScope, $location) {
  $rootScope.$on("$routeChangeError", function(event, next, previous, error) {
    // We can catch the error thrown when the $requireAuth promise is rejected
    // and redirect the user back to the home page
    if (error === "AUTH_REQUIRED") {
      $location.path("/home");
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
    getUserCharts: function(user) {
      return $firebaseObject(ref.child('charts').child(user));
    }
  }
}]);

app.service('userSvc', ['fireFactory', function(fireFactory) {
  this.setUser = function(user) {
    var userObj = {
      uid: user.uid,
      data: {
        username: user.google.email.split('@')[0],
        displayname: user.google.displayName,
        email: user.google.email,
        picture: user.google.profileImageURL,
        teacher: true
      }
    }
    return fireFactory.getRef().child('users').set(userObj);
  }
}])

app.controller('IndexCtrl', ['$scope', 'fireFactory', 'userSvc', function($scope, fireFactory, userSvc) {
  $scope.auth = fireFactory;

  $scope.auth.getAuth().$onAuth(function(authData) {
    if(authData) {
      userSvc.setUser(authData);
    }
    $scope.authData = authData;
  });

}]);

app.controller('CreateCtrl', ['$scope', 'fireFactory', function($scope, fireFactory) {
  $scope.fireFactory = fireFactory;
  $scope.fireFactory.authUser().$onAuth(function(authData) {
    $scope.authData = authData;
  });

  $scope.filesChanged = function(elm) {
    $scope.csvFile = elm.files[0];
    $scope.$apply();
  }
  $scope.create = function() {
    Papa.parse($scope.csvFile, {
      header: true,
      complete: function(result) {
        var correct = result.data.shift();
        var studentChart = {};

        console.log($scope.jsonResult);
        $scope.$apply();
      }
    });


    /**************************
    deprecated but saved for reference
    ***************************
    function filterCSV(data) {
      var answerObj = data.shift();
      var newArray = [];

      for(var i = 0; i < data.length; i++) {
        var cardObj = {};
        cardObj.username = data[i]["Username"];
        cardObj.score = data[i]["% Score"];
        cardObj.questions = [];

        for(var key in data[i]) {
          if(!data[i].hasOwnProperty(key)) {
            continue;
          }
          if(data[i][key] == 0) {
            cardObj.questions.push({front: key, back: answerObj[key]});
          }
        }
        newArray.push(cardObj);
        fireFactory.getRef().child('charts').child(cardObj.username.split('@')[0]).push(cardObj);
        //console.log(answerObj);
        //fireFactory.getRef().child('created').child($scope.authData.google.email.split('@')[0]).push(answerObj);

      }
      return newArray;

    }

    ******************************
    end of the bs
    ****************************/
  }

}])
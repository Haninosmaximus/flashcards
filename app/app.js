var app = angular.module('FlashcardApp', ['ngRoute', 'firebase']);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'app/components/index/indexView.html',
      controller: 'IndexCtrl'
    })
    .when('/create', {
      templateUrl: 'app/components/create/createView.html',
      controller: 'CreateCtrl'
    })
    .otherwise({
      redirectTo: '/'
    });
}]);

app.factory('fireFactory', ['$firebaseObject', '$firebaseAuth', function($firebaseObject, $firebaseAuth) {
  var ref = new Firebase('https://quizlet-flashcards.firebaseio.com');
  return {
    authUser: function() {
      return $firebaseAuth(ref);
    },
    getRef: function() {
      return ref;
    }
  }
}])

app.controller('IndexCtrl', ['$scope', 'fireFactory', function($scope, fireFactory) {
  $scope.auth = fireFactory;

  $scope.auth.authUser().$onAuth(function(authData) {
    if(authData) {
      $scope.auth.getRef().child('users').child(authData.uid).set(authData);
    }
    $scope.authData = authData;
  });

  $scope.flashCards = function() {
    $firebaseArray(fireFactory.getRef().child('charts'));
  }

}]);

app.controller('CreateCtrl', ['$scope', 'fireFactory', function($scope, fireFactory) {
  $scope.fireFactory = fireFactory;

  $scope.filesChanged = function(elm) {
    $scope.csvFile = elm.files[0];
    $scope.$apply();
  }
  $scope.create = function() {
    Papa.parse($scope.csvFile, {
      header: true,
      complete: function(result) {
        $scope.jsonResult = filterCSV(result.data);
        console.log($scope.jsonResult);
        $scope.$apply();
      }
    });

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

      }
      return newArray;

    }
  }

}])
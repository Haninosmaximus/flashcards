var app = angular.module('FlashcardApp', ['ngRoute']);

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

app.controller('IndexCtrl', ['$scope', function($scope) {

  $scope.data = 'welcome';

}]);

app.controller('CreateCtrl', ['$scope', function($scope) {
  $scope.filesChanged = function(elm) {
    $scope.csvFile = elm.files[0];
    $scope.$apply();
  }
  $scope.create = function() {
    Papa.parse($scope.csvFile, {
      header: true,
      complete: function(result) {
        console.log(typeof result.data);
        console.log(result.data);

        $scope.jsonResult = filterCSV(result.data);
        $scope.$apply();
      }
    });

    function filterCSV(data) {
      var answerObj = data.shift();
      var newArray = [];

      for(var i = 0; i < data.length; i++) {

        for(var key in data[i]) {
          if(!data[i].hasOwnProperty(key)) {
            continue;
          }

          if(data[i][key] == 1) {
            delete data[i][key];
          } else if(data[i][key] == 0) {
            data[i][key] = answerObj[key];
          }

        }
        newArray.push(data[i]);

      }
      return newArray;

    }
  }

}])
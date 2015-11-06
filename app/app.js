var app = angular.module('FlashcardApp', ['ngRoute']);

app.config(['$routeProvider', function($routeProvider) {
  $routeProvider
    .when('/', {
      templateUrl: 'app/components/index/indexView.html',
      controller: 'IndexCtrl'
    })
    .otherwise({
      redirectTo: '/'
    });
}]);

app.controller('IndexCtrl', ['$scope', function($scope) {

  $scope.data = 'welcome';

}])
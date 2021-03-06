(function() {
    "use strict";

    angular
        .module("TendrlModule")
        .component("clusterList", {

            restrict: "E",
            templateUrl: "/modules/clusters/cluster-list/cluster-list.html",
            bindings: {},
            controller: clusterController,
            controllerAs: "clusterCntrl"
        });

    /*@ngInject*/
    function clusterController($scope, $state, $interval, $rootScope, $uibModal, config, clusterStore, Notifications, utils) {

        var vm = this,
            key,
            len,
            temp = [],
            clusterData,
            cluster,
            clusterListTimer,
            hostList,
            i;

        vm.isDataLoading = true;
        vm.clusterNotPresent = false;
        vm.flag = false;
        vm.profilingButtonClick = false;
        $rootScope.selectedClusterOption = "allClusters";

        vm.filterBy = "name";
        vm.filterByValue = "Name";
        vm.filterPlaceholder = "Name";
        vm.clusterList = [];
        vm.changingFilterBy = changingFilterBy;
        vm.goToImportFlow = goToImportFlow;
        vm.doProfilingAction = doProfilingAction;
        vm.redirectToGrafana = redirectToGrafana;
        vm.addTooltip = addTooltip;
        vm.clearAllFilters = clearAllFilters;
        vm.openErrorModal = openErrorModal;
        vm.goToTaskDetail = goToTaskDetail;

        vm.sortConfig = {
            fields: [{
                id: "name",
                title: "Name",
                sortType: "alpha"
            }, {
                id: "status",
                title: "Status",
                sortType: "alpha"
            }, {
                id: "sdsVersion",
                title: "Cluster Version",
                sortType: "alpha"
            }, {
                id: "managed",
                title: "Managed",
                sortType: "alpha"
            }],
            onSortChange: _sortChange,
            currentField: {
                id: "name",
                title: "Name",
                sortType: "alpha"
            },
            isAscending: true
        };

        init();

        /**
         * @name init
         * @desc contains the initialisation logic
         * @memberOf clusterController
         */
        function init() {
            clusterStore.selectedTab = 1;
            clusterStore.getClusterList()
                .then(function(data) {
                    data = clusterStore.formatClusterData(data);
                    $interval.cancel(clusterListTimer);

                    if (vm.clusterList.length) {
                        vm.clusterNotPresent = false;
                    }

                    vm.clusterList = data;
                    _sortChange(vm.sortConfig.currentField.id, vm.sortConfig.isAscending);
                    startTimer();
                }).catch(function(e) {
                    vm.clusterList = [];
                }).finally(function() {
                    vm.isDataLoading = false;
                });
        }



        /* Trigger this function when we have cluster data */
        $scope.$on("GotClusterData", function(event, data) {
            /* Forward to home view if we don't have any cluster */
            if ($rootScope.clusterData === null || $rootScope.clusterData.length === 0) {
                vm.clusterNotPresent = true;
            } else {
                init();
            }
        });

        /**
         * @name startTimer
         * @desc starts the timer after a given time interval to poll cluster data
         * @memberOf clusterController
         */
        function startTimer() {

            clusterListTimer = $interval(function() {
                init();
            }, 1000 * config.refreshIntervalTime, 1);
        }

        /*Cancelling interval when scope is destroy*/
        $scope.$on("$destroy", function() {
            $interval.cancel(clusterListTimer);
        });

        /**
         * @name goToImportFlow
         * @desc takes user to import cluster flow
         * @memberOf clusterController
         */
        function goToImportFlow(cluster) {
            $rootScope.clusterTobeImported = cluster;
            $state.go("import-cluster", { clusterId: cluster.integrationId });
        }

        function redirectToGrafana(cluster, $event) {
            utils.redirectToGrafana("glance", $event, { clusterId: cluster.clusterId });
        }

        /**
         * @name doProfilingAction
         * @desc enable/disable volume profile for cluster
         * @memberOf clusterController
         */
        function doProfilingAction($event, cluster, action, clusterId) {
            vm.profilingButtonClick = true;
            clusterStore.doProfilingAction(cluster.clusterId, action)
                .then(function(data) {
                    Notifications.message("success", "", "Volume profiling " + (action === "Enable" ? "enabled" : "disabled") + " successfully.");
                    cluster = _isClusterPresent(data, clusterId);
                    vm.clusterList[cluster.index].isProfilingEnabled = data.enable_volume_profiling === "yes" ? "Enabled" : "Disabled";
                }).catch(function(error) {
                    Notifications.message("danger", "", "Failed to " + (action === "Enable" ? "enable" : "disable") + " volume profile.");
                }).finally(function() {
                    vm.profilingButtonClick = false;
                });
            $event.stopPropagation();
        }

        function clearAllFilters() {
            vm.searchBy = {};
            vm.filterBy = "name";
        }

        function openErrorModal(cluster) {
            var wizardDoneListener,
                modalInstance,
                closeWizard;

            modalInstance = $uibModal.open({
                animation: true,
                backdrop: "static",
                templateUrl: "/modules/clusters/cluster-error-list/cluster-error-list.html",
                controller: "errorListController",
                controllerAs: "vm",
                size: "lg",
                resolve: {
                    cluster: cluster
                }
            });

            closeWizard = function(e, reason) {
                modalInstance.dismiss(reason);
                wizardDoneListener();
            };

            modalInstance.result.then(function() {}, function() {});
            wizardDoneListener = $rootScope.$on("modal.done", closeWizard);
        }

        function addTooltip($event) {
            vm.flag = utils.tooltip($event);
        }

        function changingFilterBy(filterValue) {
            vm.filterBy = filterValue;
            switch (filterValue) {
                case "name":
                    vm.filterByValue = "Name";
                    vm.filterPlaceholder = "Name";
                    break;
            };
        }

        function goToTaskDetail(cluster) {
            $rootScope.selectedClusterOption = "";
            $state.go("task-detail", { clusterId: cluster.integrationId, taskId: cluster.importTaskId });
        }

        /***Private Functions***/

        /**
         * @name _isClusterPresent
         * @desc checks if cluster is present in vm.clusterList
         * @memberOf clusterController
         */
        function _isClusterPresent(cluster, profilingId) {
            var len = vm.clusterList.length,
                found = false,
                i;

            for (i = 0; i < len; i++) {

                if (profilingId && vm.clusterList[i].clusterId === profilingId) {
                    return { index: i, cluster: cluster };
                } else if (vm.clusterList[i].clusterId === cluster.clusterId) {
                    found = true;
                    return { index: i, cluster: cluster };
                }
            }

            if (found === false) {
                return -999;
            }

        }

        function _compareFn(item1, item2) {
            var compValue = 0;

            if (vm.sortConfig.currentField.id === "name") {
                compValue = item1.name.localeCompare(item2.name);
            } else if (vm.sortConfig.currentField.id === "status") {
                if (!item1.status) {
                    item1.status = "unmanaged";
                } else if (!item2.status) {
                    item2.status = "unmanaged";
                }
                compValue = item1.status.localeCompare(item2.status);
            } else if (vm.sortConfig.currentField.id === "sdsVersion") {
                compValue = item1.sdsVersion.localeCompare(item2.sdsVersion);
            } else if (vm.sortConfig.currentField.id === "managed") {
                compValue = item1.managed.localeCompare(item2.managed);
            }

            if (!vm.sortConfig.isAscending) {
                compValue = compValue * -1;
            }

            return compValue;
        }

        function _sortChange(sortId, isAscending) {
            vm.clusterList.sort(_compareFn);
        }

    }

})();

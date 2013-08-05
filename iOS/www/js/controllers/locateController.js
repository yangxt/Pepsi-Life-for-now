var requireArray = [
	"controllers/controller",
    "helpers/serverRequest",
    "views/marker",
    "controllers/userController"
];

define(requireArray, function(Controller, ServerRequest, Marker, UserController) {
var LocateController = function() {
	Controller.call(this);

	this.$container.attr("id", "locateController");
	this.$map = $("<div>", {"id": "map"});
	this.$map.appendTo(this.$container);
    this.$filterButton = $("<button>", {"id": "filterButton"});
    this.$filterButton.appendTo(this.$container);
    this.$filterButton.text("ALL");
    this.$filterButton.on("tapone", this._didClickAll.bind(this));
    this.onlyFriends = false;
    this.currentPositionMVC = new google.maps.MVCObject();
    this.currentPositionMVC.set("position", new google.maps.LatLng(-21.115141, 55.536384));
    this.selectedMarker = null;
    this.usersBydIds = {};
    navigator.geolocation.getCurrentPosition(this._didUpdatePosition.bind(this), this._didFailToUpdatePosition.bind(this), null);

    notificationCenter.on("friendNotification", this._onFriendNotification.bind(this));
    notificationCenter.on("unfriendNotification", this._onUnfriendNotification.bind(this));
};


LocateController.prototype = new Controller();

LocateController.prototype.init = function() {
    this.initalized = true;
    this.markers = {};
    var mapOptions = {
        zoom: 8,
        center: this.currentPositionMVC.get("position"),
        mapTypeId: google.maps.MapTypeId.ROADMAP,
        disableDefaultUI: true,
        maxZoom: 12,
        minZoom: 4
    };

    this.map = new google.maps.Map(this.$map[0], mapOptions);

    var currentPositionMarker = new google.maps.Marker({
        position: mapOptions.center,
        map: this.map,
        icon: "img/map/pin-current-position.png"
    });

    currentPositionMarker.bindTo("position", this.currentPositionMVC);

    google.maps.event.addListener(this.map, 'bounds_changed', this._didChangeBounds.bind(this));
};

///////////////
// Private
//////////////

LocateController.prototype._didUpdatePosition = function(position) {
    this.currentPositionMVC.set("position", new google.maps.LatLng(position.coords.latitude, position.coords.longitude));
};

LocateController.prototype._didFailToUpdatePosition = function(position) {
    alert("Fail to get your position");
};

LocateController.prototype._didChangeBounds = function() {
    var bounds = this.map.getBounds();
    var ne = bounds.getNorthEast();
    var sw = bounds.getSouthWest();

    var request = new ServerRequest();
    request.method = "GET";
    if (this.onlyFriends)
        request.path = "me/friends/";
    else
        request.path = "users/";
    request.queryParameters["from_lat"] = sw.lat();
    request.queryParameters["to_lat"] = ne.lat();
    request.queryParameters["from_long"] = sw.lng();
    request.queryParameters["to_long"] = ne.lng();

    request.onSuccess = function(json) {
        this.users = json.users || json.friends;
        var newMarkers = {};
        for (var i in this.users) {
            var user = this.users[i];
            if (this.onlyFriends)
                user.friend = true;
            if (!this.markers[user.id]) {
                this.usersBydIds[user.id] = user;
                var marker = new Marker(user);
                marker.setMap(this.map);
                marker.on("click", this._didClickMarker.bind(this, marker, user));
                marker.on("clickBubble", this._didClickMarkerBubble.bind(this, marker, user));
            }
            newMarkers[user.id] = marker ? marker : this.markers[user.id];
        }

        for (var key in this.markers) {
            if (!newMarkers[key]) {
                this.usersBydIds[key] = null;
                var marker = this.markers[key];
                if (marker == this.selectedMarker) {
                    this.selectedMarker.removeBubble();
                    this.selectedMarker = null;
                }
                marker.setMap(null);
            }
        }
        this.markers = newMarkers;

    }.bind(this);
    request.onError = function(statusCode, message) {
        alert("Error in LocateController get users request: " + statusCode + ": " + message);
    }.bind(this);
    request.execute();
};

/////////

LocateController.prototype._didClickMarker = function(marker, user) {
    if (this.selectedMarker)
        this.selectedMarker.removeBubble();
    marker.addBubble(user);
    this.selectedMarker = marker;
};

LocateController.prototype._didClickMarkerBubble = function(marker, user) {
    if (this.userController)
        return;
    var userController = new UserController(user);
    userController.$container.on("webkitAnimationEnd animationEnd", function() {
        userController.$container.off("webkitAnimationEnd animationEnd")
        userController.$container.removeClass("slideLeft");
        userController.init();
    });
    userController.$container.addClass("slideLeft");
    userController.$container.appendTo(this.$container);

    userController.on("clickBack", function() {
        userController.$container.on("webkitAnimationEnd animationEnd", function() {
            userController.$container.off("webkitAnimationEnd animationEnd")
            userController.$container.removeClass("slideRight");
            userController.$container.remove();
            this.userController = null;
        }.bind(this));
        userController.$container.addClass("slideRight");
    }.bind(this));
    this.userController = userController;
};

LocateController.prototype._didClickAll = function() {
    this.$filterButton.off("tapone");
    this.$filterButton.on("tapone", this._didClickFriends.bind(this));
    this.$filterButton.text("FRIENDS");
    this.onlyFriends = true;
    this._didChangeBounds();
};

LocateController.prototype._didClickFriends = function() {
    this.$filterButton.off("tapone");
    this.$filterButton.on("tapone", this._didClickAll.bind(this));
    this.$filterButton.text("ALL");
    this.onlyFriends = false;
    this._didChangeBounds();
};

LocateController.prototype._onFriendNotification = function(notification) {
    var user = this.usersBydIds[notification.userId];
    if (user) {
        var oldMarker = this.markers[user.id];
        oldMarker.setMap(null);
        oldMarker.removeBubble();
        this.markers[user.id] = null;
        var marker = new Marker(user);
        marker.setMap(this.map);
        marker.on("click", this._didClickMarker.bind(this, marker, user));
        marker.on("clickBubble", this._didClickMarkerBubble.bind(this, marker, user));
        if (oldMarker == this.selectedMarker) {
            this.selectedMarker = marker;
            marker.addBubble();
        }
        this.markers[user.id] = marker;
    }
};

LocateController.prototype._onUnfriendNotification = function(notification) {
    var user = this.usersBydIds[notification.userId];
    if (user) {
        var oldMarker = this.markers[user.id];
        oldMarker.setMap(null);
        oldMarker.removeBubble();
        this.markers[user.id] = null;
        if (!this.onlyFriends) {
            var marker = new Marker(user);
            marker.setMap(this.map);
            marker.on("click", this._didClickMarker.bind(this, marker, user));
            marker.on("clickBubble", this._didClickMarkerBubble.bind(this, marker, user));
            if (oldMarker == this.selectedMarker) {
                this.selectedMarker = marker;
                marker.addBubble();
            }
            this.markers[user.id] = marker;
        }
    }
};

return LocateController;
});
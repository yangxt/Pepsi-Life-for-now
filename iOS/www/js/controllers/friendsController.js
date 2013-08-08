var requireArray = [
	"controllers/controller",
	"views/tableView",
	"views/imageCell",
	"helpers/serverRequest",
	"models/post",
	"controllers/commentsController"
];


define(requireArray, function(Controller, TableView, ImageCell, ServerRequest, Post, CommentsController) {
var FriendsController = function(callback) {
	Controller.call(this);
	this.callback = callback;

	this.$container.attr("id", "friendsController");
	this.tableView = new TableView();
	this.tableView.setCellsSpacing("12px");
	this.tableView.$container.attr("id", "tableView")
	this.tableView.$cellsContainer.attr("id", "cellsContainer");
	this.tableView.$container.appendTo(this.$container);
	this.postsRemaining = true;
	this.posts = [];
	this.postsByIds = {};

	//Event Handlers
	this.tableView.on("didScrollToBottom", this._didScrollToBottom.bind(this));
	this.tableView.on("didSelectRow", this._didSelectRow.bind(this));
	this.tableView.on("rowIsVisible", this._rowIsVisible.bind(this));

	notificationCenter.on("likeNotification", this._onLikeNotification.bind(this));
	notificationCenter.on("seenNotification", this._onSeenNotification.bind(this));
	notificationCenter.on("friendNotification", this._onFriendNotification.bind(this));
	notificationCenter.on("unfriendNotification", this._onUnfriendNotification.bind(this));

	this.pushNewCells();
};

FriendsController.prototype = new Controller();

FriendsController.prototype.pushNewCells = function() {
	this.tableView.enterLoadingMode();
	var request = new ServerRequest();
	request.method = "GET";
	request.path = "posts/";
	request.queryParameters["only_friends"] = true;
	if (this.posts.length != 0)
		request.queryParameters["last_id"] = this.posts[this.posts.length - 1].id;

	request.onSuccess = function(json) {
		this.tableView.exitLoadingMode();
		var posts = json.posts;
		this.postsRemaining = posts.length == 10;
		for (var i in posts) {
			var post = Post.postFromJSONObject(posts[i]);
			this.posts.push(post);
			this.postsByIds[post.id] = post;
			var cell = new ImageCell(post);

			cell.on("didClickLike", this._didClickLike.bind(this, cell, post));
			cell.on("didClickComment", this._didClickComment.bind(this, cell, post));

			this.tableView.pushCell(cell);
		}
		if (this.posts.length == 0 && !this.$noPostsMessage) {
			this.$noPostsMessage = $("<p>");
			this.$noPostsMessage.html("No post yet.<br/>Go make some new friends!");
			this.$noPostsMessage.appendTo(this.$container);
		}
		else if (this.posts.length != 0 && this.$noPostsMessage)
			this.$noPostsMessage.remove();
		this.callback();
	}.bind(this);
	request.onError = function(statusCode, message) {
		this.tableView.exitLoadingMode();
		alert("Error", "The posts couldn't be loaded. Please check your internet connection.");
		this.callback();
	}.bind(this);
	request.execute();
};


///////////////////////////////
// Private
//////////////////////////////

FriendsController.prototype._didScrollToBottom = function() {
	if (!this.tableView.loading && this.postsRemaining) {
		this.pushNewCells();
	}
};

FriendsController.prototype._didSelectRow = function(row) {

};

FriendsController.prototype._didClickLike = function(cell, post) {
	if (post.liked)
		return;

	post.liked = true;
	var request = new ServerRequest();
	request.path = "posts/" + post.id + "/likes";
	request.method = "POST";
	request.onSuccess = function(json) {
		cell.setLikesCount(cell.getLikesCount() + 1);
		cell.setLiked(true);
		notificationCenter.trigger("likeNotification", {postId: post.id, notifier: this});
	}.bind(this);
	request.onError = function(status, message) {
		if (statusCode != 403) {
			post.like = false;
		}
	}.bind(this);
	request.execute();
};

FriendsController.prototype._didClickComment = function(cell, post) {
	if (this.commentsController)
		return;
	var commentsController = new CommentsController(post);
	commentsController.$container.on("webkitAnimationEnd animationEnd", function() {
        commentsController.$container.off("webkitAnimationEnd animationEnd")
        commentsController.$container.removeClass("slideLeft");
        commentsController.init();
    });
    commentsController.$container.addClass("slideLeft");
    commentsController.$container.appendTo(this.$container);

    commentsController.on("clickBack", function() {
        commentsController.$container.on("webkitAnimationEnd animationEnd", function() {
            commentsController.$container.off("webkitAnimationEnd animationEnd")
            commentsController.$container.removeClass("slideRight");
            commentsController.$container.remove();
            this.commentsController = null;
        }.bind(this));
        commentsController.$container.addClass("slideRight");
    }.bind(this));
    this.commentsController = commentsController;
};

FriendsController.prototype._rowIsVisible = function(row) {
	var post = this.posts[row];
	var cell = this.tableView.cellForRow(row);
	if (post.seen)
		return

	post.seen = true;
	var request = new ServerRequest();
	request.path = "posts/" + post.id + "/seens";
	request.method = "POST";
	request.onSuccess = function(json) {
		cell.setSeensCount(cell.getSeensCount() + 1);
		notificationCenter.trigger("seenNotification", {postId: post.id, notifier: this});
	}.bind(this);
	request.onError = function(status, message) {
		if (statusCode != 403) {
			post.seen = false;
		}
	}.bind(this);
	request.execute();
};

FriendsController.prototype._onLikeNotification = function(notification) {
	if (notification.notifier == this)
		return;
	var post = this.postsByIds[notification.postId];
	if (post && !post.liked) {
		post.liked = true;
		post.likesCount++;
		var cell = this.tableView.cellForRow(this.posts.indexOf(post));
		cell.setLikesCount(cell.getLikesCount() + 1);
		cell.setLiked(true);
	}
};

FriendsController.prototype._onSeenNotification = function(notification) {
	if (notification.notifier == this)
		return;
	var post = this.postsByIds[notification.postId];
	if (post && !post.seen) {
		post.seen = true;
		post.seensCount++;
		var cell = this.tableView.cellForRow(this.posts.indexOf(post));
		if (cell.setSeensCount)
			cell.setSeensCount(cell.getSeensCount() + 1);
	}
};

FriendsController.prototype._onFriendNotification = function(notification) {
	this._reloadTableView();
};

FriendsController.prototype._onUnfriendNotification = function(notification) {
	this._reloadTableView();
};

FriendsController.prototype._reloadTableView = function() {
	this.tableView.removeAllRows();
	this.posts = [];
	this.postsByIds = {};
	this.postsRemaining = true;
	this.pushNewCells();
};

return FriendsController;
});
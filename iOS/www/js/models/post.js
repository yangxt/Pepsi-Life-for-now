
function parseDate(dateString) {
	var regex = /(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})Z/
	var components = regex.exec(dateString);
	if (!components)
		return null;
	var year = components[1];
	var month = components[2];
	var day = components[3];
	var hours = components[4];
	var minutes = components[5];
	var seconds = components[6];
	return new Date(Date.UTC(year, month, day, hours, minutes, seconds));
}

define(function() {
	var Post = function() {
		this.id = null;
		this.text = null;
		this.imageUrl = null;
		this.tags = [];
		this.creationDate = null;
		this.likesCount = null;
		this.seensCount = null;
		this.ownerName = null;
		this.ownerImageUrl = null;
	};

	Post.postFromJSONObject = function(jsonObject) {
		var post = new Post();
		post.id = jsonObject.id;
		post.text = jsonObject.text;
		post.imageUrl = jsonObject.image_url;
		post.tags = jsonObject.tags;
		post.creationDate = parseDate(jsonObject.creation_date);
		post.likesCount = jsonObject.likes_count;
		post.seensCount = jsonObject.seens_count
		post.ownerName = jsonObject.owner.name;
		post.ownerImageUrl = jsonObject.owner.image_url;
		return post;
	};

	return Post;
});
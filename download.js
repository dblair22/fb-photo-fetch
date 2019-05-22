var fs = require("fs");
var async = require("async");
var path = require("path");
var debug = require("debug")("download");
var request = require("request");
var mkdirp = require("mkdirp");
var streamToBuffer = require("stream-to-buffer");
var touch = require("touch");

var addExif = require("./add_exif");

module.exports = function(albums, dest, photoSelector) {
  mkdirp.sync(dest);

  async.each(albums, downloadAlbum, function(err) {
    if (err) throw err;

    debug("Finished downloading all albums");
  });

  function downloadAlbum(album, dlAlbumCb) {
    var albumPath = path.join(dest, album.name);

    mkdirp.sync(albumPath);

    async.each(album.photos.filter(photoSelector), downloadPhoto, function(
      err
    ) {
      debug("Finished downloading " + album.name);
      dlAlbumCb(err);
    });

    function downloadPhoto(photo, cb) {
      var filePath = path.join(albumPath, photo.id + ".jpg");

      fs.stat(filePath, function(stat_err, stats) {
        if (stat_err) {
          var source =
            (Array.isArray(photo.images) &&
              photo.images.length > 0 &&
              photo.images[0].source) ||
            photo.source;
          if (source != null && source) {
            request(source)
              .on("response", function(response) {
                streamToBuffer(response, function(err, buffer) {
                  if (err) {
                    return debug(
                      "Error converting " + (photo.name || photo.id)
                    );
                  }
                  try {
                    var result = addExif(photo, buffer.toString("binary"));
                  }
                  catch (error) {
                    return debug(
                      "Error adding exif data to " + (photo.name || photo.id)
                    );
                  }

                  fs.writeFile(filePath, result, "binary", function(err) {
                    if (err) {
                      return cb(err);
                    }

                    var opts = {
                      time: photo.created_time
                    };

                    setTimeout(function() {
                      touch(filePath, opts, cb);
                    }, 10);
                  });
                });
              })
              .on("error", function(err) {
                debug("Error downloading " + photo.id + err.toString());
              });
          }
        }
      });
    }
  }
};

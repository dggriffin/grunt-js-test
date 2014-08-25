'use strict';

var fs = require('fs');
var path = require('path');
var moment = require('moment');

var normalize = function (file) {
  return path.normalize(file).toLowerCase();
};

module.exports = function (grunt, options) {
  return {

    coverageReportDirectory: function () {
      // ensure the coverage report directory exists
      if (!fs.existsSync(options.coverageReportDirectory)) {
        fs.mkdirSync(options.coverageReportDirectory);
      }

      // create a unique test identifier if none is provided
      if (!options.identifier) {
        options.identifier = moment().format('YYYY-MM-DD HHMMSS');
      }

      // return the new path (do not create the directory at this time)
      return path.join(options.coverageReportDirectory, options.identifier);
    },

    // look in given file for <reference> tags
    // filter down to return only files with given extension
    findReferenceTags: function (file, extFilter) {
      var directory = path.dirname(file);
      var re = /\/\/\/\s*<reference.+path=\"(.+)\".*\/>/gi;
      var contents = fs.readFileSync(file, {encoding: 'utf8'}).toString();
      var files = [];
      var match;

      while ((match = re.exec(contents))) {
        files.push(
          path.join(directory, match[1])
        );
      }

      if (typeof extFilter === 'string') {
        return files.filter(function (reference) {
          return path.extname(reference) === extFilter;
        });
      }

      return files;
    },

    getDependencies: function (files) {
      // ensure files is an array
      if (!Array.isArray(files)) {
        files = [files];
      }

      // standardize all paths to be non-case sensitive
      files = files.map(normalize);

      // a {file: dependencies} dictionary object
      var data = {};

      var findDeps = function findDeps(filePath) {
        return this.findReferenceTags(filePath, '.js').map(normalize);
      }.bind(this);

      var recursive = function (file) {
        var deps = findDeps(file);
        data[file] = deps;
        deps.forEach(recursive);
      };

      // go through each file we need and find their dependencies, recursively
      files.forEach(recursive);

      var included = {};

      var include = function (name) {
        // confirm this file has not been included
        if (included[name]) {
          return;
        }

        if (typeof data[name] === 'undefined') {
          grunt.log.error('Script ' + name + ' not found!');
          return;
        }

        // include all deps before including this
        data[name].forEach(include);

        // mark this file as being included so we do not re-include
        included[name] = true;
      };

      files.forEach(include);

      // optionally remove the files and only return the deps for the file
      if (options.requirejs) {
        files.forEach(function (file) {
          delete included[file];
        });
      }

      // convert a provided dependency (which is an absolute file path)
      // to web-accessible URIs for the given location
      var resolveReferenceTag = function (dep) {
        return path.join(options.baseUri, path.relative(options.root, dep)).replace(/\\/g, '/');
      };

      // the included object will now be the sorted dependencies
      return Object.keys(included).map(resolveReferenceTag);
    }

  };
};
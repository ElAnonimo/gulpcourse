var gulp = require('gulp');
var args = require('yargs').argv;
var browserSync = require('browser-sync');
var config = require('./gulp.config')();
var del = require('del');
var path = require('path');
var _ = require('lodash');
var $ = require('gulp-load-plugins')({lazy: true});
var port = process.env.PORT || config.defaultPort;

gulp.task('help', $.taskListing);
gulp.task('default', ['help']);

gulp.task('vet', function() {
	log('Analyzing source with JSHint and JSCS');

	return gulp
		.src(config.alljs)
		.pipe($.if(args.verbose, $.print()))
		.pipe($.jscs())
		.pipe($.jshint())
		.pipe($.jshint.reporter('jshint-stylish', {verbose: true}))
		.pipe($.jshint.reporter('fail'));
});

gulp.task('styles', ['clean-styles'], function() {
	log('Compiling LESS --> CSS');
	
	return gulp
		.src(config.less)
		.pipe($.less())
		.pipe($.plumber())
		// .on('error', errorLogger)
		.pipe($.autoprefixer({browsers: ['last 2 version', '> 5%']}))
		.pipe(gulp.dest(config.temp));
});

gulp.task('fonts', ['clean-fonts'], function() {
	log('Copying fonts');
	
	return gulp
		.src(config.fonts)
		.pipe(gulp.dest(config.build + 'fonts'));
});

gulp.task('images', ['clean-images'], function() {
	log('Copying and compressing images');
	
	return gulp
		.src(config.images)
		.pipe($.imagemin({optimizationLevel: 4}))
		.pipe(gulp.dest(config.build + 'images'));
});

gulp.task('clean', function() {
	var delconfig = [].concat(config.build, config.temp);
	log('Cleaning: ' + $.util.colors.blue(delconfig));
	del(delconfig);
});

gulp.task('clean-fonts', function() {
	clean(config.build + 'fonts/**/*.*');
});

gulp.task('clean-images', function() {
	clean(config.build + 'images/**/*.*');
});

gulp.task('clean-styles', function() {
	var files = config.temp + '**/*.css';
	clean(files);
});

gulp.task('clean-code', function() {
	var files = [].concat(
		config.temp + '**/*.js',
		config.build + '**/*.html',
		config.build + 'js/**/*.js'
	);
	clean(files);
});

gulp.task('less-watcher', function() {
	gulp.watch([config.less], ['styles']);
});

gulp.task('templatecache', ['clean-code'], function() {
	log('Creating AngularJS $templateCache');
	
	return gulp
		.src(config.htmltemplates)
		.pipe($.minifyHtml({empty: true}))					// to include empty html tags too
		.pipe($.angularTemplatecache(								
			config.templateCache.file,								// templateCache.file for cache file we create
			config.templateCache.options
		))					
		.pipe(gulp.dest(config.temp));
});

gulp.task('wiredep', function() {
	log('Wiring up bower css and js plus our application js into index.html');
	
	var options = config.getWiredepConfigOptions();
	var wiredep = require('wiredep').stream;
	
	return gulp
		.src(config.index)
		.pipe(wiredep(options))
		.pipe($.inject(gulp.src(config.js)))
		.pipe(gulp.dest(config.client));
});

gulp.task('inject', ['wiredep', 'styles', 'templatecache'], function() {
	log('Wiring up our application css into index.html');
	
	return gulp
		.src(config.index)
		.pipe($.inject(gulp.src(config.css)))
		.pipe(gulp.dest(config.client));
});

gulp.task('build', ['optimize', 'images', 'fonts'], function() {
	log('Building everything');
	
	var msg = {
		title: 'gulp build',
		subtitle: 'Deployed to the build folder',
		message: 'Running `gulp serve-build`'
	};
	
	del(config.temp);
	log(msg);
	notify(msg);
});

gulp.task('optimize', ['inject', 'test'], function() {
	log('Optimizing js, css, html');
	
	// var assets = $.useref.assets({searchPath: './'});
	var templateCache = config.temp + config.templateCache.file;
	var cssFilter = $.filter('**/*.css', {restore: true});
	var jsLibFilter = $.filter('**/' + config.optimized.lib, {restore: true});
	var jsAppFilter = $.filter('**/' + config.optimized.app, {restore: true});
	
	return gulp
		.src(config.index)
		.pipe($.plumber())
		.pipe($.inject(gulp.src(templateCache, {read: false}), {starttag: '<!-- inject:templates:js -->'}))
		// .pipe(assets)
		// .pipe(assets.restore())
		.pipe($.useref({searchPath: './'}))
		.pipe(cssFilter)
		.pipe($.csso())
		.pipe(cssFilter.restore)
		.pipe(jsLibFilter)
		.pipe($.uglify())
		.pipe(jsLibFilter.restore)
		.pipe(jsAppFilter)
		.pipe($.ngAnnotate({add: true}))	// default. To keep annotations e.g. ngInject. Otherwise remove: true
		.pipe($.uglify())
		.pipe(jsAppFilter.restore)
		.pipe($.rev())										// app.js --> app-2423gewg.js
		.pipe($.revReplace())
		.pipe(gulp.dest(config.build))
		.pipe($.rev.manifest())
		.pipe(gulp.dest(config.build));
});

/**
 * Bump the version
 * --type=pre will bump the prerelease version *.*.*-x
 * --type=patch or no flag will bump the patch version *.*.x
 * --type=minor will bump the minor version *.x.*
 * --type=major will bump the major version x.*.*
 * --version=1.2.3 will bump to a specific version and ignore other flags
 */
gulp.task('bump', function() {
	var msg = 'Bumping version';
	var type = args.type;
	var version = args.version;
	var options = {};
	
	if (version) {
		options.version = version;
		msg += ' to ' + version;
	} else {
		options.type = type;
		msg += ' for a ' + type;
	}
	
	log(msg);
	
	return gulp
		.src(config.packages)
		.pipe($.print())
		.pipe($.bump(options))
		.pipe(gulp.dest(config.root));
});

gulp.task('serve-build', ['build'], function() {
	serve(false);
});

gulp.task('serve-dev', ['inject'], function() {
	serve(true);
});

gulp.task('test', ['vet', 'templatecache'], function(done) {
	startTests(true, done);						// true for single run test
});

gulp.task('autotest', ['vet', 'templatecache'], function(done) {
	startTests(false, done);					// false for continuously running test
});

////////////

function serve(isDev) {
	var nodeOptions = {
		script: config.nodeServer,			// server script to run. We run app.js
		delayTime: 1,
		env: {
			'PORT': port,
			'NODE_ENV': isDev ? 'dev' : 'build'
		},
		watch: [config.server]					// files to restart upon
	};
	
	return $.nodemon(nodeOptions)
		.on('restart', ['vet'], function(event) {
			log('*** nodemon restarted');
			log('files changed on restart:\n' + event);
			setTimeout(function() {
				browserSync.notify('reloading now...');
				browserSync.reload({stream: false});
			}, config.browserReloadDelay);
		})
		.on('start', function() {
			log('*** nodemon started');
			startBrowserSync(isDev);
		})
		.on('crash', function() {
			log('*** nodemon crashed: script crashed for some reason');
		})
		.on('exit', function() {
			log('*** nodemon exited cleanly');
		});
}

function changeEvent(event) {
	var srcPattern = new RegExp('/.*(?=/' + config.source + ')/');
	log('File ' + event.path.replace(srcPattern, '') + ' ' + event.type);
}

function notify(options) {
	var notifier = require('node-notifier');
	var notifyOptions = {
		sound: 'Bottle',
		contentImage: path.join(__dirname, 'gulp.png'),
		icon: path.join(__dirname, 'gulp.png')
	};
	_.assign(notifyOptions, options);
	notifier.notify(notifyOptions);
}

function startBrowserSync(isDev) {
	if (args.nosync || browserSync.active) {
		return;
	}
	
	log('Starting browser-sync on port ' + port);
	
	if (isDev) {
		gulp.watch([config.less], ['styles'])
			.on('change', function(event) {
				changeEvent(event);
			});
	} else {
		gulp.watch([config.less, config.js, config.html], ['optimize', browserSync.reload])
			.on('change', function(event) {
				changeEvent(event);
			});
	}
	
	var options = {
		proxy: 'localhost:' + port,
		port: 3000,
		files: isDev ? [					// reload upon these files change
			config.client + '**/*.*',
			'!' + config.less,
			config.temp + '**/*.css'
		] : [],			
		ghostMode: {
			clicks: true,
			location: false,
			forms: true,
			scroll: true
		},
		injectChanges: true,			// inject only the changed files. If false reload the whole page
		logFileChanges: true,
		logLevel: 'debug',
		logPrefix: 'gulp-patterns',
		notify: true,							// a popup to notify the changes successfully applied
		reloadDelay: 1000
	};
	
	browserSync(options);
}

function startTests(singleRun, done) {
	var karma = require('karma').server;
	var excludeFiles = [];
	var serverSpecs = config.serverIntegrationSpecs;
	
	excludeFiles = serverSpecs;
	
	karma.start({
		configFile: __dirname + '/karma.conf.js',
		exclude: excludeFiles,
		singleRun: !!singleRun
	}, karmaCompleted);
	
	function karmaCompleted(karmaResult) {
		log('Karma completed');
		
		if (karmaResult === 1) {
			done('Karma: test failed with code ' + karmaResult);
		} else {
			done();
		}
	}
}

function errorLogger(error) {
	log('*** Start of Error ***');
	log(error);
	log('*** End of Error ***');
	this.emit('end');
}

function clean(path) {
	log('Cleaning: ' + $.util.colors.blue(path));
	del(path);
}

function log(msg) {
	if (typeof(msg) === 'object') {
		for (var item in msg) {
			if (msg.hasOwnProperty(item)) {
				$.util.log($.util.colors.blue(msg[item]));
			}
		}
	} else {
		$.util.log($.util.colors.blue(msg));
	}
}

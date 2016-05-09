module.exports = function() {
	var client = './src/client/';
	var clientApp = client + 'app/';
	var report = './report/';
	var root = './';
	var temp = './.tmp/';
	var server = './src/server/';
	var wiredep = require('wiredep');
	var bowerFiles = wiredep({devDependencies: true})['js'];				// give me devDependencies and dependencies

	var config = {
		/* Files paths */
		
		/* all js to vet */
		alljs: [
			'./src/**/*.js',
			'./*.js'
		],
		build: './build/',
		client: client,
		css: temp + 'styles.css',
		fonts: './bower_components/font-awesome/fonts/**/*.*',
		html: clientApp + '**/*.html',
		htmltemplates: clientApp + '**/*.html',
		images: client + 'images/**/*.*',
		index: client + 'index.html',
		js: [
			clientApp + '**/*.module.js',
			clientApp + '**/*.js',
			'!' + clientApp + '**/*.spec.js'
		],
		less: client + 'styles/styles.less',
		report: report,
		root: root,
		server: server,
		temp: temp,
		
		/* optimized files names */
		optimized: {
			app: 'app.js',
			lib: 'lib.js'
		},
		
		/* template cache */
		templateCache: {
			file: 'templates.js',
			options: {
				module: 'app.core',
				standAlone: false,	// false to not create a new Angular module. We put to the existing app.core
				root: 'app/'				// strip 'app/' off at the beginning of the URL
			}
		},
		
		/* browser sync */
		browserReloadDelay: 1000,
		
		/* Bower and NPM locations */
		bower: {
			json: require('./bower.json'),
			directory: './bower_components',
			ignorePath: '../..'
		},
		
		packages: [
			'./package.json',
			'./bower.json'
		],
		
		/* Karma and testing settings */
		specHelpers: [client + 'test-helpers/*.js'],
		serverIntegrationSpecs: [client + 'tests/server-integration/**/*.spec.js'],
		
		/* Node setting */
		defaultPort: 7203,
		nodeServer: './src/server/app.js'
	};
	
	config.getWiredepConfigOptions = function() {
		var options = {
			bowerJson: config.bower.json,
			directory: config.bower.directory,
			ignorePath: config.bower.ignorePath
		};
		return options;
	};
	
	config.karma = getKarmaOptions();

	return config;
	
	/////////////////////
	
	function getKarmaOptions() {
		var options = {
			files: [].concat(
				bowerFiles,
				config.specHelpers,
				client + '**/*.module.js',
				client + '**/*.js',
				temp + config.templateCache.file,
				config.serverIntegrationSpecs
			),
			exclude: [],
			coverage: {									// what files tests cover i.e. applied to
				dir: report + 'coverage',
				reporters: [
					{type: 'html', subdir: 'report-html'},
					{type: 'lcov', subdir: 'report-lcov'},
					{type: 'text-summary'}	// no file name supplied so it outputs it to the console
				]
			},
			preprocessors: {}
		};
		options.preprocessors[clientApp + '**/!(*.spec)+(.js)'] = ['coverage'];
		return options;
	}
};

// import http
// import file creation
const util = require('util');
const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const cheerio = require('cheerio');
const config = require('./config');

// Promisify stuff for cleaner code...
const promises = {
	readFile: util.promisify(fs.readFile),
	writeFile: util.promisify(fs.writeFile),
	copyFolderRecursive: copyFolderRecursive,
	deleteFolderRecursive: deleteFolderRecursive,
	getUrlContents: getUrlContents
}

// Current page...
let currentChapter = config.start; //config.start

// Setup some vars for the book...
async function populateBook() {
	console.log('Populating Book');
	// Make sure everything is copied over and reset...
	await copySrc();

	// // Loop through...
	var nextUrl = config.url.base + config.url.path;
	while(nextUrl) {
		nextUrl = await populateChapter(nextUrl); // Populate chapter returns nextUrl... so whilst we have that keep calling it...
	}

	// // Populate the docs
	await populateTocDoc();
	await populateContentDoc();

	// Let us know we're done...
	console.log('Populated! Please zip up dist, rename extension to .epub, and convert to .mobi online if using kindle');
}

// Copy over the src folder to dist...
async function copySrc() {
	console.log('Populating Dist');
	await promises.deleteFolderRecursive('./dist');
	await promises.copyFolderRecursive('./src', './dist');

	return true;
}

// Scrape the chapter from the URL...
async function populateChapter(url) {
	console.log('Populating Chapter - '+url);
	const response = await promises.getUrlContents(url);
	const $ = cheerio.load(response);
	let contents = await promises.readFile(config.src.template, {encoding: 'utf8'});
	let strings = {};

	// Get next...
	let $next = $(config.selectors.next);
	let nextUrl = $next.attr('href');

	// If we've reached the end, then return false and stop the loop
	if($next.length === 0 || nextUrl === '#') {
		return false;
	}

	// If no base then add it...
	if(!nextUrl.includes('//')) {
		nextUrl = config.url.base + nextUrl;
	}

	// Remove stuff...
	$(config.selectors.remove).remove();

	// Get title and body...
	strings.title = $(config.selectors.title).html();
	$(config.selectors.title).remove(); // Remove title after scraping it...
	strings.body = $(config.selectors.body).html();

	// Build the page
	contents = contents.replace('<!--strings.title-->', strings.title);
	contents = contents.replace('<!--strings.body-->', strings.body);

	// HTML fixes...
	contents = contents.replace(/<hr>/g, '<hr/>');
	contents = contents.replace(/<br>/g, '<br/>');

	// Write the file to dist...
	await promises.writeFile('./dist/OEBPS/text/'+config.slug+'-'+currentChapter+'.xhtml', contents);
	console.log('Populated Chaper - '+url);

	// Updating finish index...
	currentChapter++;

	return nextUrl;
}

// This populates the toc.ncx
async function populateTocDoc() {
	console.log('Populating Toc');
	// Get contents...
	var contents = await promises.readFile(config.src.toc, {encoding: 'utf8'});
	var strings = {};

	// Build the strings...
	strings.title = config.title;
	strings.uuid = '<meta content="urn:uuid:carlsimmons-'+config.slug+'" name="dtb:uid"/>';
	strings.navpoints = '';

	for(var index = 1; index <= currentChapter; index++) {
		strings.navpoints = strings.navpoints+'<navPoint id="navPoint-'+(index+config.prepages)+'" playOrder="'+(index+config.prepages)+'"><navLabel><text>Chapter '+index+'</text></navLabel><content src="text/'+config.slug+'-'+index+'.xhtml"/></navPoint>';
	}

	// Replace contents... we could probably build a function to basically template the file... do a smart regular expression that loops through an object... but eh
	contents = contents.replace('<!--strings.title-->', strings.title);
	contents = contents.replace('<!--strings.uuid-->', strings.uuid);
	contents = contents.replace('<!--strings.navpoints-->', strings.navpoints);
	// Write to file...
	await promises.writeFile(config.dist.toc, contents);

	return true;
}

// This populates the content.opf file...
async function populateContentDoc() {
	console.log('Populating Content');
	// Get contents...
	var contents = await promises.readFile(config.src.content, {encoding: 'utf8'});
	var strings = {};

	// Build the strings...
	strings.title = config.title;
	strings.uuid = '<dc:identifier opf:scheme="UUID" id="BookId">urn:uuid:carlsimmons-'+config.slug+'</dc:identifier>';
	strings.items = '';
	strings.itemrefs = '';

	for(var index = 1; index <= currentChapter; index++) {
		strings.items = strings.items+'<item id="'+config.slug+'-'+index+'.xhtml" href="text/'+config.slug+'-'+index+'.xhtml" media-type="application/xhtml+xml"/>';
		strings.itemrefs = strings.itemrefs+'<itemref idref="'+config.slug+'-'+index+'.xhtml"/>';
	}

	// Replace contents... we could probably build a function to basically template the file... do a smart regular expression that loops through an object... but eh
	contents = contents.replace('<!--strings.title-->', strings.title);
	contents = contents.replace('<!--strings.uuid-->', strings.uuid);
	contents = contents.replace('<!--strings.items-->', strings.items);
	contents = contents.replace('<!--strings.itemrefs-->', strings.itemrefs);

	// Write to file...
	await promises.writeFile(config.dist.content, contents);

	return true;
}

// Just get the HTML of the page...
async function getUrlContents(config, callback) {
	return new Promise(function (resolve, reject) {
		var request = https.get(config, (response) => {
			var html = '';

			response.setEncoding('utf8');

			response.on('error', function(e) {
				reject('problem with request: ' + e.message);
			});

			response.on('data', (chunk) => {
				html = html + chunk;
			});

			response.on('end', (chunk) => {
				resolve(html);
			});
		});
		request.end();
	});
}

// Clear folder...
async function deleteFolderRecursive(path) {
	if (fs.existsSync(path)) {
		fs.readdirSync(path).forEach(function(file, index){
			var curPath = path + "/" + file;
			if (fs.lstatSync(curPath).isDirectory()) { // recurse
				deleteFolderRecursive(curPath);
			} else { // delete file
				fs.unlinkSync(curPath);
			}
		});

		fs.rmdirSync(path);
	} 
}

// Copy folder...
async function copyFolderRecursive(src, dest) {
  var exists = fs.existsSync(src);
  var stats = exists && fs.statSync(src);
  var isDirectory = exists && stats.isDirectory();
  if (exists && isDirectory) {
    fs.mkdirSync(dest);
    fs.readdirSync(src).forEach(function(childItemName) {
      	copyFolderRecursive(path.join(src, childItemName),
        path.join(dest, childItemName));
    });
  } else {
    fs.linkSync(src, dest);
  }
};

// Init!
populateBook();
// This is a .js file instead of json purely because I want to comment
module.exports = {
	title: '7k',
	slug: 'awe',
	url: { // URL of where we are starting from...
		base: 'https://www.wuxiaworld.com',
		path: '/novel/7-killers/7k-chapter-7'
	},
	start: 1, // What index are we starting from? Sometimes we might want to start from where we last left off...
	prepages: 1, // How many pages there are before the chapters...
	selectors: { // Will vary depending on the HTML... basically selectors to find title/body/next chapter link and finally the junk to remove
		title: '.caption h4',
		body: '.fr-view',
		next: '.next a',
		remove: '#jp-post-flair, .wpcnt, a:contains("Previous Chapter"), a:contains("Next Chapter"), hr, audio'
	},
	src: {
		template: './src/OEBPS/text/_template.xhtml',
		toc: './src/OEBPS/toc.ncx',
		content: './src/OEBPS/content.opf'
	},
	dist: {
		toc: './dist/OEBPS/toc.ncx',
		content: './dist/OEBPS/content.opf'
	}
}
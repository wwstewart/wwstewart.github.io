# William Stewart

The source for my portfolio site. I’m a cybersecurity student at the University of Cincinnati looking for an IT, security, or networking internship.

Claude, an AI model made by Anthropic, wrote this site’s code and copy from my prompts, my resume, and my writing rules. I directed the work and made the final calls. The site’s AI page (`ai.html`) shows how.

The site is plain HTML, CSS, and a few small scripts, with no frameworks, cookies, trackers, or browser storage. Every page carries a Content Security Policy that only allows the site’s own files, and the fonts (Work Sans and IBM Plex Mono) are hosted with the site, so the pages make no requests to other servers. The home page and the trust center check this live in your browser.

It is laid out as a case file: the cover carries a seal drawn in your browser from the signals it gives every site (nothing is stored or sent), each piece of work is an exhibit that says what evidence it has, the trust center answers the questions a security team would ask, and the plain version is the resume as one page with no scripts.

The cover also carries an evidence board (`assets/board.js`): the exhibits as cards you can drag, with string between the ones that belong together. The two buttons in the bottom left corner are the play layer (`assets/play.js`): a UV light that reveals notes written in invisible ink, and a console (type `help`) that also checks the six flags hidden around the site, by hashing what you type with SHA 256 in your browser.

The motion is its own layer (`assets/motion.css`, `assets/motion.js`, `assets/scene.js`, `assets/visit.js`) that the pages work without: with scripts off nothing is missing but the movement, and with reduced motion on nothing travels. The "Your visit" panel in the corner logs what you do on the page the way a security operations center would read a session, in memory only, and Wipe clears it.

## Files

* `index.html`: the cover: the seal, the live check, and the exhibit index
* `clickbond.html`: Exhibit 01, my IT internship at Click Bond, summer 2026, with an evidence drawer on each entry
* `ai.html`: Exhibit 06, how I use AI, with my real prompts (the build log that listed the messages behind this site was removed on November 6, 2026)
* `trust.html`: the trust center: what the site collects and loads, its policy, how it was built, how to report a problem, the changelog, and what draws the seal
* `plain.html`, `resume.txt`: the plain version, the resume as one page with no scripts, and the same as text
* `.well-known/security.txt`: the standard security contact file; `.nojekyll` tells GitHub Pages to serve every file as it is
* `assets/styles.css`: the shared design: colors (light and dark), type, layout, and buttons
* `assets/casefile.css`, `assets/casefile.js`: the case file layer: exhibit labels, the seal, the index rail, evidence drawers, the trust and plain pages
* `assets/site.js`: the Copy email button
* `assets/check.css`, `assets/check.js`: the live security check
* `assets/inspect.css`, `assets/inspect.js`: Inspect mode, which shows how each part of a page is built
* `assets/map.css`, `assets/map.js`: the work map on the cover
* `assets/ai.css`, `assets/ai.js`: the AI page
* `assets/motion.css`, `assets/motion.js`: the motion layer: the opening, scroll reveals and declassify bars, the live index, the header progress line, page transitions, the custom cursor, the seal tilt, magnetic buttons, drawer motion, skill chips, the map pulse, the paper grain, pages opening at the top from the nav, and the corner buttons fading at the footer
* `assets/scene.js`: the network drawn behind the cover (a canvas; it follows the pointer and pauses when off screen)
* `assets/board.css`, `assets/board.js`: the evidence board
* `assets/play.css`, `assets/play.js`: the UV light, the invisible ink notes, the console, and the flag checker
* `assets/visit.js`: the Your visit panel
* `assets/fonts/`: Work Sans and IBM Plex Mono, under the SIL Open Font License
* `William_Stewart_Resume.pdf`: my resume

To view it locally, run `python3 -m http.server` in this folder and open http://localhost:8000. Opened straight from a file, the pages work, but browsers block the font.

import * as rpl from './replacer.js';

var script = null;

export default class Script extends Plugin {

    constructor(mods) {
        super();
        script = this;
        this.mods = mods;
        this.regex = null; // Initialized after options are loaded
        this.words = null; // Initialized in async prestart
        this.optionsLoaded = false;
        /*
        I need to know some options to decide how to change messages, and
        it just so happens that some messages are loaded before the options.
        These messages are pushed into this queue and are initialized
        after the options have been loaded.
        An alternative to this approach would be to save the options in dome config file
        in the mod folder but I decided the first approach would be less problematic.
        */
        this.messageQueue = [];
    }

    async prestart() {
        this.words = await fetch("/assets/mods/Word Changer/words.json").then(res=>res.json());
        for (let word in this.words) {
        	if (this.words[word].stretchable) {
        		this.words[word].regex = new RegExp("^" + this.words[word].string + "$", "i");
        	}
        }
		sc.OPTIONS_DEFINITION['word-changer-nickname'] = {
			cat: sc.OPTION_CATEGORY.GENERAL,
			type: 'CHECKBOX',
			init: false,
			restart: false,
    	};
		for (let word in this.words) {
	    	sc.OPTIONS_DEFINITION['word-changer-info-' + word] = {
		        cat: sc.OPTION_CATEGORY.GENERAL,
		        type: "INFO",
		        data: "options.word-changer-info-" + word + ".description"
		    };
			sc.OPTIONS_DEFINITION['word-changer-toggle-' + word] = {
				cat: sc.OPTION_CATEGORY.GENERAL,
				type: 'CHECKBOX',
				init: false,
				restart: false,
	    	};
		}

		// SHOW_OFFSCREEN_MSG and SHOW_DREAM_MSG are afaik not used by Lea
		// I might add them later anyway
		ig.EVENT_STEP.SHOW_MSG.inject({init: dialogueInit});
		ig.EVENT_STEP.SHOW_SIDE_MSG.inject({init: dialogueInit});
		ig.EVENT_STEP.SHOW_GET_MSG.inject({
			init: function(a) {
				this.parent(a);
				this.text = replace(this.text);
			}
		});
    }

    main() {

    	for (let word in this.words) {
    		this.words[word].active = sc.options.values["word-changer-toggle-"+word];
    		let replacement = sc.options.values["word-changer-info-"+word] || word;
			initReplacement(word, replacement);
    	}
	    this.updateRegex();
	    this.optionsLoaded = true;
	    for (let arr of this.messageQueue) {
	    	dialogueInit(arr[0], arr[1]); // initializes the messages
	    }
	    this.messageQueue = null;

    	ig.lang.labels.sc.gui.options['word-changer-nickname'] = {
			name: "Also replace name",
			description: "If enabled, how others call you will also be changed."
		};

    	sc.Model.addObserver(sc.options, {
    		modelChanged: function() {
    			var words = script.words;
    			for (let word in words) {
    				let option = sc.options.values["word-changer-toggle-"+word];
    				if (option && !words[word].active) {
    					words[word].active = true;
    					if (sc.menu.directMenu == 8) { // if in menu
    						getReplacement(word, words[word].replacement, words);
    						script.updateRegex();
    					}
    				} else if (!option && words[word].active) {
    					words[word].active = false;
    					script.updateRegex();
    				}
    			}
    		}
    	});
    }

    updateRegex() {
    	var result = "(?:";
    	for (const word in this.words) {
    		if (!this.words[word].active) {
    			continue;
    		}
    		if (!this.words[word].stretchable) {
    			result += word + "|";
    		} else {
    			result += this.words[word].string + "|";
    		}
    	}
    	if (result == "(?:") {
    		this.regex = /(?!)/gi;
    		return;
    	}
    	result = result.substring(0, result.length - 1) + ")";
    	this.regex = new RegExp(result, "gi");
    }
}

function replace(string, regex) {
	if (!regex) {
		regex = script.regex;
	}
	return string.replace(regex,
			(match, offset, string) => rpl.replacer(match, offset, string, script.words));
}

function dialogueInit(a, parent) {
	if (!parent) {
		parent = this.parent.bind(this);
	}
	if (!script.optionsLoaded) {
		script.messageQueue.push([a, parent]);
		return;
	}
	if (a.person.person == "main.lea") {
		a.message.en_US = replace(a.message.en_US);
	} else if (sc.options.values["word-changer-nickname"]) {
		a.message.en_US = replace(a.message.en_US, /\blea\b/gi);
	}
	parent(a);
}

function initReplacement(original, replacement) {
	script.words[original].replacement = replacement;
	if (script.words[original].stretchable) {
		script.words[original].replacementParts = rpl.splitReplacement(replacement);
	}

	let toggletext = 'Replace "' + original + '"';
	let infotext = 'Current replacement for "' + original + '": ' + replacement;

	ig.lang.labels.sc.gui.options['word-changer-toggle-' + original] = {
		name: toggletext,
		description: "Tick to replace this word with another."
	};

	ig.lang.labels.sc.gui.options['word-changer-info-' + original] = {
		description: infotext
	};
}

function getReplacement(original, prevReplacement) {
	if(window.ig && window.ig.system){
		// I've chosen the gamecodeMessage overlay because it's in the format I want
	    var overlay = ig.dom.html('<div class="gameOverlayBox gamecodeMessage" ><h3>Enter replacement for "' + original + '"</h3></div>');
	    var form = ig.dom.html('<form><input type="text" name="replacement" value="' + prevReplacement + '" /><input type="submit" name="send" value="Submit" /><form>');
	    overlay.append(form);
	    form.submit(function(){
	        let replacement = form[0].replacement.value.toLowerCase() || original;
	        updateReplacement(original, replacement);
	        ig.system.regainFocus();
	        return false;
	    });

	    $(document.body).append(overlay);
	    window.setTimeout(function(){
	        overlay.addClass("shown");
	    }, 20);
	    ig.system.setFocusLost();

	    var close = function(){
	        overlay.remove();
	    };
	    ig.system.addFocusListener(close);
	    form.find("input[type=text]").focus();
	}
}

function updateReplacement(original, replacement) {

	script.words[original].replacement = replacement;
	if (script.words[original].stretchable) {
		script.words[original].replacementParts = rpl.splitReplacement(replacement);
	}

	var infotext = 'Current replacement for "' + original + '": ' + replacement;

	sc.options.values["word-changer-info-" + original] = replacement;
	ig.lang.labels.sc.gui.options['word-changer-info-' + original].description = infotext;
	var options = sc.menu.guiReference.submenus.options.listBox.rows;
	for (let ind in options) {
		// The code below relies on the info box being directly above the toggle option.
		// This has been the only way I've found to find the correct info box.
		if (options[ind].optionName == "word-changer-toggle-" + original) {
			options[ind-1].text.setText(infotext);
            break;
		}
	}
}
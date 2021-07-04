/*jshint esversion: 8 */
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

        var maxId = -1;
		for (let cat in sc.OPTION_CATEGORY) {
			let id = sc.OPTION_CATEGORY[cat];
			maxId = (id > maxId) ? id : maxId;
		}
		sc.OPTION_CATEGORY.WORD_CHANGER = maxId + 1;

		for (let word in this.words) {
	    	sc.OPTIONS_DEFINITION['word-changer-info-' + word] = {
		        cat: sc.OPTION_CATEGORY.WORD_CHANGER,
		        type: "INFO",
		        data: "options.word-changer-info-" + word + ".description"
		    };
			sc.OPTIONS_DEFINITION['word-changer-toggle-' + word] = {
				cat: sc.OPTION_CATEGORY.WORD_CHANGER,
				type: 'CHECKBOX',
				init: false,
				restart: false,
	    	};
		}
		sc.fontsystem.font.setMapping({"word-changer": [0, 58]});
		
		sc.OptionsTabBox.inject({
			init: function(b) {
				this.parent(b);
				var tabNum = 0;
				for (let ind in this.tabs) {
					if (this.tabs[ind]) {
						tabNum++;
					}
				}
				this.tabs["word-changer"] = this._createTabButton("word-changer", tabNum, sc.OPTION_CATEGORY.WORD_CHANGER);
			}
		})

		ig.LangLabel.inject({
			init: function(a) {
				if (a.en_US) {
					a.en_US = replace(a.en_US, /\blea\b/gi, {"lea": script.words.lea});
				}
				this.parent(a);
			}
		});
		ig.EVENT_STEP.SHOW_MSG.inject({init: dialogueInit});
		ig.EVENT_STEP.SHOW_SIDE_MSG.inject({init: dialogueInit});
		ig.EVENT_STEP.SHOW_GET_MSG.inject({
			init: function(a) {
				if (a.msgType == "WORD" && a.object.en_US) {
					replace(a.object.en_US);
				}
				this.parent(a);
			}
		});
		ig.EVENT_STEP.SHOW_CHOICE.inject({
			init: function(a) {
				for (let option of a.options) {
					if (option.label.en_US) {
						option.label.en_US = replace(option.label.en_US);
					}
				}
				this.parent(a);
			}
		})
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

		ig.lang.labels.sc.gui.menu.option["word-changer"] = "Words";

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

function replace(string, regex, words) {
	// I keep track of which strings I have changed with a null character in the end.
	// I put it in the end to avoid conflict with another mod (uwuifier) that uses this.
	// Another alternative would be to add a "replaced" field to the parent of the replaced
	// string, but I feel this method is much simpler.
	if (!string || string[string.length-1] === '\0') {
		return string;
	}
	if (!regex) {
		regex = script.regex;
	}
	if (!words) {
		words = script.words;
	}
	return string.replace(regex,
			(match, offset, string) => rpl.replacer(match, offset, string, words)) + '\0';
}

function dialogueInit(a, parent) {
	if (!a.message.en_US) {
		return this.parent(a);
	}
	if (!parent) {
		parent = this.parent.bind(this);
	}
	if (!script.optionsLoaded) {
		script.messageQueue.push([a, parent]);
		return;
	}
	if (a.person.person == "main.lea") {
		a.message.en_US = replace(a.message.en_US);
	} else if (script.words.lea.active) {
		a.message.en_US = replace(a.message.en_US, /\blea\b/gi, {"lea": script.words.lea});
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

	if (original != "lea") {
		ig.lang.labels.sc.gui.options['word-changer-toggle-' + original] = {
			name: toggletext,
			description: "Tick to replace this word with another."
		};

		ig.lang.labels.sc.gui.options['word-changer-info-' + original] = {
			description: infotext
		};
	} else {
		ig.lang.labels.sc.gui.options['word-changer-toggle-lea'] = {
			name: "Replace character name",
			description: "Tick to change the main character's name."
		};

		ig.lang.labels.sc.gui.options['word-changer-info-lea'] = {
			description: "Current name: " + replacement + ". This is used by the character as well as others."
		};

		manuallyReplaceLea();
	}
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
	var infotext;
	if (original != "lea") {
		infotext = 'Current replacement for "' + original + '": ' + replacement;
    } else {
    	infotext = "Current name: " + replacement + ". This is used by the character as well as others.";
    	manuallyReplaceLea();
    }
    ig.lang.labels.sc.gui.options['word-changer-info-' + original].description = infotext;

	sc.options.values["word-changer-info-" + original] = replacement;
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

function manuallyReplaceLea() {
	var capitalized = script.words.lea.replacement;
	capitalized = capitalized[0].toUpperCase() + capitalized.substring(1);
	sc.model.leaConfig.character.data.name.en_US = capitalized;
	ig.database.data.lore.lea.title.en_US = capitalized;
	ig.database.data.achievements["landmarks-total-04"].name.en_US = `${capitalized} the Explorer`;
	ig.database.data.areas["cargo-ship"].landmarks.teleporter.description.en_US = `At the Cargo Hold where ${capitalized} started her journey.`;
	ig.lang.labels.sc.gui.menu.stats.keys.yawns = `Total Number of Times ${capitalized} was bored`;
	ig.lang.labels.sc.gui.menu.stats.keys.hiCount = `Total Number of Times ${capitalized} said "${script.words.hi.replacement}"`;
	ig.lang.labels.sc.gui.menu["help-texts"].map.pages[1].content[2] = `Selecting yes closes the menu and teleports ${capitalized} to the location of the landmark`;
	ig.lang.labels.sc.gui.menu["help-texts"].lore.pages[1].content[3] = `I added some extra code here for you, ${capitalized}. Next to the in-game categories I added one for your progress and one for characters.`;
}

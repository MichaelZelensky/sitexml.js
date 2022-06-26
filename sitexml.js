/**
 *
 * SiteXML JavaScript class
 *
 * @author Michael Zelensky http://miha.in, contributor Aleksei Kolola https://twitter.com/a_kolola (c) 2017-2022
 * @license MIT
 *
 * Repository:
 * https://github.com/MichaelZelensky/sitexml.js
 *
 * Description:
 * https://sitexml.info/sitexml.js
 *
 *
 * Usage:
 * var SiteXML = new sitexml();
 *
 * "Public" methods (methods that are supposed to be used as public):
 * loadSitexml ()
 * loadContent (id)
 * saveContent (id, content)
 * saveXML (xmlstr)
 * getContentIdByPIDandName (id, [parent])
 * getPageById (id)
 * getContentIdByPidPname(pid, name)
 * getDefaultTheme()
 * getPageTheme(pid)
 * getThemeById(theme_id)
 */


function sitexml (path) {

    this.path = path || ''; //without closing slash "/"

    /**
     * Executes ?sitexml STP command.
     * Triggers 'sitexml.is.loaded' event.
     * Creates the following properties:
     *   - this.sitexml - raw server response body;
     *   - this.sitexmlObj - .site.xml parsed, resulting in document type javascript object;
     *   - this.siteObj - javascript object representing the site.
     */
    this.loadSitexml = function () {
        var me = this;
        this.httpGetAsync(this.path + '/?sitexml', function (r) {
            me.sitexml = r;
            me.sitexmlObj = me.parseXML(r);
            me.siteObj = me.getSiteObj();
            if (me.sitexmlObj.childNodes[0] && me.sitexmlObj.childNodes[0].nodeName.toLowerCase() === "site") {
                me.triggerEvent(window, 'sitexml.is.loaded');
            } else {
                me.triggerEvent(window, 'sitexml.is.not.valid');
            }
        });
    };

    /**
     * Loads content by id, filename, or page id + content name.
     * Caches the loaded content in this.content.
	 *
     * @param {Integer} id - get content by id.
     */
    this.loadContent = function (id) {
        var me = this,
            loadedContent = {},
            str = this.path;
        if ((typeof id).toLowerCase() === 'number' || id * 1) {
            id = id * 1;
            if (id) {
                str += '/?cid=' + id;
                loadedContent.id = id;
            }
        }
        this.httpGetAsync(str, function (r) {
            loadedContent.content = r;
            me.content = me.content || {};
            me.content[id + ''] = r;
            me.triggerEvent(window, 'content.is.loaded', {cid: id});
        });
    };

    /**
     * Saves content by its id, content name.
	 *
     * @param {Integer} id - content id.
	 * @param {String} content - content name.
     */
    this.saveContent = function(id, content) {
        var me = this,
            params,
            str = this.path;
        if ((typeof id).toLowerCase() === 'number' || id * 1) {
            id = id * 1;
            if (id) {
                str += '/';
                params = "cid=" + id + "&content=" + encodeURIComponent(content)
                this.httpPostAsync(str, params, function (r) {
                    if (r === '401') {
                        me.triggerEvent(window, 'content.not.saved.401', {cid: id});
                    } else {
                        me.triggerEvent(window, 'content.is.saved', {cid: id});
                    }

                });
            }
        }
    };

    /**
     * Saves XML as string.
	 *
	 * @param {String} xmlstr - XML represented as string.
     */
    this.saveXML = function(xmlstr) {
        var me = this,
            params,
            str = this.path + '/';
        params = "sitexml=" + xmlstr;
        this.httpPostAsync(str, params, function (r) {
            if (r === '401') {
                me.triggerEvent(window, 'xml.not.saved.401');
            } else {
                me.triggerEvent(window, 'xml.is.saved');
            }
        });
    };

    /**
     * Gets content by page id, page name.
     * Caches the loaded content in this.content.
	 *
     * @param {Integer} pid - page id.
	 * @param {String} id - page name.
     */
    this.getContentIdByPidPname = function (pid, name) {
        var page = this.getPageById(pid);
        if (page && page.content) {
            for (var i = 0, n = page.content.length; i < n; i++) {
                if (page.content[i].attributes.name === name) {
                    return page.content[i].attributes.id;
                }
            }
        }
        return undefined;
    };

    /**
     * Recursive function, which returns content object by content id.
	 *
     * @param {Integer} cid - content id.
	 * @param {Object} parent.
 	 * @return {String} content.
     */
    this.getContentById = function (cid, parent) {
        var parent = parent || this.siteObj,
            content = undefined,
            p = parent.pages;
        for (var i = 0, n = p.length; i < n; i++) {
            loop1:
                if (p[i].content && p[i].content.length > 0) {
                    for (var j = 0, m = p[i].content.length; j < m; j++) {
                        if (p[i].content[j].attributes.id * 1 === cid * 1) {
                            content = p[i].content[j];
                            break loop1;
                        }
                    }
                }
            if (!content && p[i].pages && p[i].pages.length > 0) {
                content = this.getContentById(cid, p[i]);
            }
        }
        return content;
    };

    /**
     * Recursive function, which gets page by id, parent.
	 *
     * @param {Integer} id - page id.
     * @param {Object} parent.
     * @requires this.siteObj.
	 * @return {undefined} undefined.
     */
    this.getPageById = function (id, parent) {
        var page;
        parent = parent || (this.siteObj);
        for (var i = 0, n = parent.pages.length; i < n; i++) {
            if (parent.pages[i].attributes.id * 1 === id * 1) {
                return parent.pages[i];
            } else if (parent.pages[i].pages) {
                page = this.getPageById(id, parent.pages[i]);
                if (page) {
                    return page;
                }
            }
        }
        return undefined;
    };

    /**
     * Returns default theme if PAGE@theme is not defined (see algorithm: http://sitexml.info/algorithms)
	 *
	 * @return {undefined} theme.
     */
    this.getDefaultTheme = function () {
        var theme = undefined;
        if (this.siteObj.themes && this.siteObj.themes.length > 0) {
            for (var i = 0, n = this.siteObj.themes.length; i < n; i++) {
                if (this.siteObj.themes[i].attributes.default === 'yes') {
                    theme = this.siteObj.themes[i];
                }
            }
            if (!theme) {
                theme = this.siteObj.themes[0];
            }
        }
        return theme;
    };

    /*
     * @param {Integer} id - page id
     * @requires this.siteObj
	 * @param {Object} parent
	 * Returns theme object for a page, see algorithm here: http://sitexml.info/algorithms
     * */
    this.getPageTheme = function (id, parent) {
        var tid, theme, page;
        if (id) {
            page = this.getPageById(id);
            if (page && page.attributes && page.attributes.theme) { //1. getting page's theme
                tid = page.attributes.theme;
                theme = this.getThemeById(tid);
            }
            if (this.siteObj.themes && this.siteObj.themes.length > 0) {
                if (!theme) { //2. getting default theme
                    for (var i = 0, n = this.siteObj.themes.length; i < n; i++) {
                        if (this.siteObj.themes[i].attributes.default && this.siteObj.themes[i].attributes.default.toLowerCase() === 'yes') {
                            theme = this.siteObj.themes[i];
                            break;
                        }
                    }
                }
                if (!theme) { // 3. getting the first theme
                    theme = this.siteObj.themes[0];
                }
            }
        }
        return theme || undefined;
    };

    //
    this.getThemeById = function(id) {
        var theme;
        if (this.siteObj && this.siteObj.themes && this.siteObj.themes.length > 0) {
            for (var i = 0, n = this.siteObj.themes.length; i < n; i++) {
                if (id * 1 === this.siteObj.themes[i].attributes.id * 1) {
                    theme = this.siteObj.themes[i];
                    break;
                }
            }
        }
        return theme || undefined;
    };

    //http://stackoverflow.com/questions/247483/http-get-request-in-javascript
    this.httpGetAsync = function (theUrl, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4) {
                if (xmlHttp.status == 200) {
                    callback(xmlHttp.responseText);
                } else if (Math.floor(xmlHttp.status / 100) === 4 || Math.floor(xmlHttp.status / 100) === 5) {
                    callback('Content file error: ' + xmlHttp.status);
                }
            }
        };
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
        xmlHttp.send(null);
    };

    //https://stackoverflow.com/questions/9713058/send-post-data-using-xmlhttprequest
    this.httpPostAsync = function (theUrl, params, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4) {
                if (xmlHttp.status == 200) {
                    callback(xmlHttp.responseText);
                } else if (xmlHttp.status == 401) {
                    callback('401');
                } else if (Math.floor(xmlHttp.status / 100) === 4 || Math.floor(xmlHttp.status / 100) === 5) {
                    callback('Content file error: ' + xmlHttp.status);
                }
            }
        };
        xmlHttp.open("POST", theUrl, true); // true for asynchronous
        //Send the proper header information along with the request
        xmlHttp.setRequestHeader("Content-type", "application/x-www-form-urlencoded");
        xmlHttp.send(params);
    };

    //
    this.triggerEvent = function (element, name, data) {
        var event; // The custom event that will be created

        if (document.createEvent) {
            event = document.createEvent("HTMLEvents");
            event.initEvent(name, true, true);
        } else {
            event = document.createEventObject();
            event.eventType = name;
        }

        event.eventName = name;
        if (data) {
            event.data = data;
        }

        if (document.createEvent) {
            element.dispatchEvent(event);
        } else {
            element.fireEvent("on" + event.eventType, event);
        }
    };

    //
    this.parseXML = function (xmlstring) {
        var oParser = new DOMParser(),
            oDOM = oParser.parseFromString(xmlstring, "text/xml");
        if (oDOM.documentElement.nodeName == "parsererror") {
            return "error while parsing";
        } else {
            return oDOM;
        }
    };

    //
    this.getSiteObj = function () {
        var site, page, meta, themes, theme,
            siteObj = {
                name : undefined,
                metas : [],
                themes : [],
                pages : []
            },
            xml = this.sitexmlObj;
        if (xml) {
            site = xml.getElementsByTagName('site');
            if (site.length > 0) {
                siteObj.name = site[0].getAttribute('name');
                siteObj.metas = getMeta(site[0]);
                siteObj.pages = getPages(site[0]);
                //themes
                themes = site[0].getElementsByTagName('theme');
                for (var i = 0, n = themes.length; i < n;  i++) { if (themes.hasOwnProperty(i)) {
                    theme = {
                        attributes : {
                            id : themes[i].getAttribute('id'),
                            dir : themes[i].getAttribute('dir'),
                            file : themes[i].getAttribute('file'),
                            default : themes[i].getAttribute('default'),
                            ajaxbrowsing : (themes[i].getAttribute('ajaxbrowsing')||'').trim(),
                            name : themes[i].getAttribute('name')
                        }
                    };
                    theme.content = getContent(themes[i]);
                    siteObj.themes.push(theme);
                }}
            }
        }

        /*
         * Returns page objects of the given parent element of the site tree
         * @returns {Array} - of objects
         * @param {DOM Object} - parent element
         * */
        function getPages(parent) {
            var ps, page, pages, subpages;
            if (parent && parent.getElementsByTagName) {
                ps = parent.getElementsByTagName('page');
                ps = Array.prototype.slice.call(ps);
                ps = ps.filter(function(v, i){
                    return v.parentElement === parent;
                });
                if (ps.length) {
                    pages = [];
                    for (var i = 0, n = ps.length; i < n; i++) { if (ps.hasOwnProperty(i)) {
                        page = {
                            attributes : {
                                id : ps[i].getAttribute('id'),
                                name : ps[i].getAttribute('name'),
                                alias : ps[i].getAttribute('alias'),
                                theme : ps[i].getAttribute('theme'),
                                nonavi : ps[i].getAttribute('nonavi'),
                                startpage : ps[i].getAttribute('type')
                            },
                            content : getContent(ps[i]),
                            metas : getMeta(ps[i])
                        };
                        subpages = getPages(ps[i]);
                        if (subpages) {
                            page.pages = subpages;
                        }
                        pages.push(page);
                    }}
                }
            }
            return pages;
        }

        /*
         Returns meta objects of the given parent element of the site tree
         @returns {Array} - of objects
         @param {DOM Object} - parent element
         */
        function getMeta (parent) {
            var metas, meta;
            if (parent && parent.getElementsByTagName) {
                metas = parent.getElementsByTagName('meta');
                metas = Array.prototype.slice.call(metas);
                metas = metas.filter(function(v, i){
                    return v.parentElement === parent;
                });
                if (metas.length) {
                    meta = [];
                    for (var i = 0, n = metas.length; i < n; i++) { if (metas.hasOwnProperty(i)) {
                        meta.push({
                            attributes : {
                                name : metas[i].getAttribute('name'),
                                charset : metas[i].getAttribute('charset'),
                                httpEquiv : metas[i].getAttribute('http-equiv'),
                                scheme : metas[i].getAttribute('scheme'),
                                content : metas[i].getAttribute('content')
                            },
                            content : metas[i].innerHTML
                        });
                    }}
                }
            }
            return meta;
        }

        /*
         Returns content objects of the given parent element of the site tree
         @returns {Array} - of objects
         @param {DOM Object} - parent element
         */
        function getContent(parent) {
            var cs, content;
            if (parent && parent.getElementsByTagName) {
                cs = parent.getElementsByTagName('content');
                cs = Array.prototype.slice.call(cs);
                cs = cs.filter(function(v, i){
                    return v.parentElement === parent;
                });
                if (cs.length) {
                    content = [];
                    for (var i = 0, n = cs.length; i < n; i++) { if (cs.hasOwnProperty(i)) {
                        content.push({
                            attributes : {
                                id : cs[i].getAttribute('id'),
                                name : cs[i].getAttribute('name'),
                                type : cs[i].getAttribute('type')
                            },
                            content : cs[i].innerHTML
                        });
                    }}
                }
            }
            return content;
        }

        return siteObj;
    };
}
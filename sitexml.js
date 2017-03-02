/**
 *
 * SiteXML JavaScript class
 *
 * https://github.com/MichaelZelensky/sitexml.js
 * https://sitexml.info/sitexml.js
 *
 * @author Michael Zelensky http://miha.in (c) 2017
 * @license MIT
 *
 * Usage:
 *
 * var sitexml = new sitexml();
 *
 */


function sitexml (path) {

    this.path = path || '';

    /*
    Executes ?sitexml STP command
    triggers 'sitexml.is.loaded' event
    saves
     */
    this.loadSitexml = function () {
        var me = this;
        this.httpGetAsync(this.path + '?sitexml', function (r) {
            me.sitexml = r;
            me.sitexmlObj = me.parseXML(r);
            me.siteObj = me.getSiteObj();
            me.triggerEvent(window, 'sitexml.is.loaded');
        });
    };

    /*
    Loads content by id, filename, or page id + content name
    @Param {Integer} id - get content by id
    @Param {String} id - get content directly by filename
    @Param {Object} id - example: {id: [pid], name: [content_name]}, will generate STP request ?id=pid&name=cname
     */
    this.loadContent = function (id) {
        var me = this,
            str = this.path;
        if ((typeof id).toLowerCase() === 'string') {
            if (str !== '' && str[str.length - 1] !== '/') {
                str += '/';
            }
            str += '.content/' + encodeURI(id);
        } else if ((typeof id).toLowerCase() === 'number') {
            id = id * 1;
            if (id) {
                str += '?cid=' + id;
            }
        } else if ((typeof id).toLowerCase() === 'object') {
            if (id.id) {
                id.id = id.id * 1;
            }
            if (id.id && id.name) {
                str += '?id=' + id.id + '&name=' + encodeURI(id.name);
            }
        }
        this.httpGetAsync(str, function (r) {
            me.lastLoadedContent = r;
            me.triggerEvent(window, 'content.is.loaded');
        });
    };

    //http://stackoverflow.com/questions/247483/http-get-request-in-javascript
    this.httpGetAsync = function (theUrl, callback) {
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.onreadystatechange = function() {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200)
                callback(xmlHttp.responseText);
        };
        xmlHttp.open("GET", theUrl, true); // true for asynchronous
        xmlHttp.send(null);
    };

    //
    this.triggerEvent = function (element, name) {
        var event; // The custom event that will be created

        if (document.createEvent) {
            event = document.createEvent("HTMLEvents");
            event.initEvent(name, true, true);
        } else {
            event = document.createEventObject();
            event.eventType = name;
        }

        event.eventName = name;

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
                            default : themes[i].getAttribute('default')
                        }
                    };
                    theme.content = getContent(themes[i]);
                    siteObj.themes.push(theme);
                }}
            }
        }

        /*
        Returns page objects of the given parent element of the site tree
        @returns {Array} - of objects
        @param {DOM Object} - parent element
        */
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
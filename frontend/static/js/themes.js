themes = (function () {
    /*
     * Private
     */

    var _debug = true;

    /*
     * ModelData : Object definition to store templates and parameters for a theme
     */
    var ModelData = function() {
        this.model = "";
        this.colors = {};
        this.page_styles = "";
        this.page_layouts = {};
        this.structure_blocs = {};
        this.element_blocs = {};
        this.dataviz_components = {};
        this._reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');
        this._reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    };

    /*
     * _cache : This var stores all data from already loaded theme file
     */
    var _cache = {};

    /*
     * _loadModel : Load HTML templates and parameters from server theme file
     */
    var _loadModel = function (model_name, callback) {
        // retourne directement les données du thème s'il a déjà été chargé
        if (model_name in _cache) return (callback) ? callback(true, _cache[ model_name ]) : true;
        
        // sinon analyse du fichier contenant les templates sur le serveur
        $.ajax({
            url: "/static/html/model-" + model_name + ".html",
            dataType: "html" //"xml"
        })
        .fail(function (xhr, status, err) {
            console.error("Erreur au chargement du fichier html/model-" + model_name + ".html :\n", err);
            _cache[ model_name ] = false;
        })
        .done(function (data, status, xhr) {
            if (_debug) console.debug("Chargement du fichier html du thème '" + model_name + "' :\n", data);
            const parser = new DOMParser();
            _cache[ model_name ] = _parseHtml( parser.parseFromString(data, "text/html") );
            if (_debug) console.debug("Récupération des données du thème '" + model_name + "' :\n", _cache[ model_name ]);
            if (callback) callback(true, _cache[ model_name ]);
        })
    };

    /*
     * _parseHtml : Method used to parse HTML templates and initialize the object
     */
    var _parseHtml = function(html) {
        let data = new ModelData();
        try {
            data.model = html.firstElementChild.id;
            
            // retrieve color palette
            data.colors = {};
            html.querySelectorAll("template.report-params").forEach(template => {
                template.content.querySelectorAll("[type='color']").forEach(color => {
                    data.colors[ color.id ] = {
                        'label': color.getAttribute('name'),
                        'value': color.getAttribute('value')
                    };
                });
            });
            
            // retrieve specific CSS
            data.page_styles = Array.prototype.map.call(
                html.querySelectorAll("style"),
                (style) => { return style.textContent.trim(); }
            ).join("\n").trim();
            
            // retrieve composition wrapper containers
            data.page_layouts = {};
            html.querySelectorAll("template.report-layout").forEach(template => {
                data.page_layouts[ template.id ] = _readHtml(template);
            });
            
            // retrieve all report-structure & report-element blocs
            data.structure_blocs = {};
            html.querySelectorAll("template.report-structure").forEach(template => {
                data.structure_blocs[ template.id ] = _readHtml(template);
            });
            data.element_blocs = {};
            html.querySelectorAll("template.report-element").forEach(template => {
                data.element_blocs[ template.id ] = _readHtml(template);
            });
            
            // retrieve all dataviz components
            data.dataviz_components = {};
            html.querySelectorAll("template.report-component").forEach(template => {
                data.dataviz_components[ template.getAttribute('data-ref') ] = _readHtml(template);
            });
        } catch (error) {
            console.error("Impossible de récupérer les données du thème depuis le modèle :\n", html, error);
            return false;
        }
        return data;
    };

    /*
     * _readHtml : Method used to read all HTML code inside a template Node
     */
    var _readHtml = function(template, mode = '') {
        try {
            switch (mode) {
               case 'all'   : return template.innerHTML.trim();
               case 'node'  : return template.firstElementChild.innerHTML.trim();
               case 'tnode'  : return template.content.firstElementChild.innerHTML.trim();
               case 'nodes' : return Array.prototype.map.call( template.children, (child) => { 
                   return child.outerHTML.trim();
               }).join("\n").trim();
               case 'tnodes' : return Array.prototype.map.call( template.content.children, (child) => { 
                   return child.outerHTML.trim();
               }).join("\n").trim();
               case 'clean' : return Array.prototype.map.call( template.children, (child) => { 
                   return child.outerHTML.replace(/<!--.*-->/g, "").replace(/>\s+</g, "><").trim();
               }).join("\n").trim();
               case 'tclean' : return Array.prototype.map.call( template.content.children, (child) => { 
                   return child.outerHTML.replace(/<!--.*-->/g, "").replace(/>\s+</g, "><").trim();
               }).join("\n").trim();
               default : return Array.prototype.map.call( template.content.childNodes, (child) => { 
                   if (child.nodeType == Node.TEXT_NODE) return child.nodeValue.trim();
                   if (child.nodeType == Node.ELEMENT_NODE) return child.outerHTML.replace(/<!--.*-->/g, "").replace(/>\s+</g, "><").trim();
               }).join("\n").trim();
            }
        } catch (error) {
            console.error("Impossible de récupérer le contenu HTML du template :\n", template, error);
        }
    };

    // retourne le code HTML d'un bloc structurant à partir des templates
    ModelData.prototype.makeStructureBloc = function(ref) {
        if (! this.structure_blocs[ref]) return '[STRUCTURE NOT FOUND: '+ref+']';
        if (! ('wstructure' in this.page_layouts)) return this.structure_blocs[ref];
        
        let $bloc = $( this.structure_blocs[ref] ).find('.bloc-structure').addBack('.bloc-structure');
        return this.page_layouts['wstructure']
            .replaceAll("{{LABEL}}", ($bloc) ? $bloc.data('label') : "")
            .replaceAll("{{HTML}}",  this.structure_blocs[ref])
            .replaceAll("{{REF}}",   ref)
        ;
    };

    // retourne le code HTML d'un bloc élémentaire à partir des templates
    ModelData.prototype.makeElementBloc = function(ref) {
        if (! this.element_blocs[ref]) return '[ELEMENT NOT FOUND: '+ref+']';
        if (! ('welement' in this.page_layouts)) return this.element_blocs[ref];
        
        let $bloc = $( this.element_blocs[ref] ).find('.bloc-element').addBack('.bloc-element');
        return this.page_layouts['welement']
            .replaceAll("{{LABEL}}", ($bloc) ? $bloc.data("label") : "")
            .replaceAll("{{HTML}}",  this.element_blocs[ref])
            .replaceAll("{{REF}}",   ref)
        ;
    };

    /*
     * _setTextData - modification du contenu d'un texte éditable à partir des données JSON (load ou edit)
     */
    ModelData.prototype.setTextData = function (data, node) {
        if (! node) return false;
        if (typeof data === "String") data = { 'content': data, 'style': "", 'isHTML': false };
        for (const c of node.classList.values()) if (c.startsWith('style-')) node.classList.remove(c);
        if (data.style)  node.classList.add('style-' + data.style);
        if (data.isHTML) node.innerHTML = data.content;
        else             node.innerText = data.content;
        return true;
    };

    /*
     * buildReportBloc : traitement des blocs définis dans un rapport pour génération du DOM de composition
     */
    ModelData.prototype.buildReportBloc = function(jsonBloc) {
        let ref = jsonBloc.ref || '-';
        
        // génération du HTML du bloc structurant d'après les templates du thème (layout+structure)
        let $structure = $( this.makeStructureBloc(ref) );
        if (! $structure.length) { console.warn("Bloc invalide: aucun bloc structurant disponible correspondant (ignoré)", ref); return; }
        
        // intégration des données du JSON dans le DOM du composer
        if ('title'   in jsonBloc) this.setTextData( jsonBloc.title,   $structure.find('.bloc-title')[0] ); //TODO tester si [0] inexistant
        if ('sources' in jsonBloc) this.setTextData( jsonBloc.sources, $structure.find('.bloc-sources')[0] ); //TODO tester si [0] inexistant
        if ('layout'  in jsonBloc) this.buildReportLayout( jsonBloc.layout, $structure.find('.bloc-layout') );
        
        // retourne la structure HTML du bloc à ajouter dans l'interface de composition
        if (_debug) console.debug("Bloc HTML généré du JSON :\n", $structure);
        return $structure;
    };

    /*
     * buildReportLayout : génération et ajout du code HTML du layout (récursif) d'un bloc structurant
     */
    ModelData.prototype.buildReportLayout = function(jsonLayout, $node) {
        if (! $node.length) return console.warn("Layout invalide: aucun conteneur disponible pour les données", jsonLayout);
        
        // traitement d'un noeud "rows" ou "cols" avec sa liste d'enfants
        if (jsonLayout.type == 'rows' || jsonLayout.type == 'cols') {
            let childIdx = 0;
            let $children = $node.children('.layout-rows, .layout-cols, .layout-cell, .layout-data');
            if (jsonLayout.node) jsonLayout.node.forEach((child) => {
                let $child = (childIdx < $children.length) ? $( $children[childIdx++] ) : $('<div>').appendTo( $node );
                // nettoyage des classes ('col-#', 'layout-#' et 'row')
                let nodeClass = $child.attr('class') || '';
                $child.attr('class', nodeClass.replace(this._reSize, '$1$3').replace(this._reType, '$1$3')).removeClass('col row');
                // génération du code HTML de l'enfant selon son type
                if ('type' in child) switch(child.type) {
                    case 'rows': this.buildReportLayout(child, $child.addClass('layout-rows col-' + (child.size || 1))); break;
                    case 'cols': this.buildReportLayout(child, $child.addClass('layout-cols row')); break;
                    case 'cell': this.buildReportLayout(child, $child.addClass('layout-cell col-' + (child.size || 1))); break;
                    case 'data': this.buildReportLayout(child, $child.addClass('layout-data')); break;
                    default: console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", child.type);
                }
            });
            return;
        }
        
        // traitement d'un noeud "data" ou "cell" avec sa liste de composants (dataviz|element)
        if (jsonLayout.type == 'cell' || jsonLayout.type == 'data') {
            let $container = $node.find('.components-container').addBack('.components-container').first();
            if (! $container.length) {
                $node.append( this.page_layouts['wcell'] );
                $container = $node.find('.components-container').first();
            }
            if (jsonLayout.data) jsonLayout.data.forEach((data) => this.buildReportComponent(data, $container));
            if (jsonLayout.node) console.warn("Layout invalide: présence d'enfants dans un noeud terminal (ignorés)", jsonLayout.node);
            return;
        }
        
        console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", jsonLayout.type);
    };

    /**
     * buildReportComponent : génération et ajout du code HTML d'un composant (dataviz|element) d'un rapport
     */
    ModelData.prototype.buildReportComponent = function (jsonComponent, $node) {
        if (! $node.length) return console.warn("Aucun conteneur pour composants (dataviz|element)", $node);
        let $item;
        switch (jsonComponent.type) {
            case 'element': $item = this.buildReportElement(jsonComponent.ref, jsonComponent.opts); break;
            case 'dataviz': $item = this.buildReportDataviz(jsonComponent.ref, jsonComponent.opts); break;
        }
        if ($item) $node.append($item);
    };

    /*
     * buildReportElement: used to generate composition HTML for an element component
     */
    ModelData.prototype.buildReportElement = function (ref, opts) {
        if (! ref) return;
        
        // génération du HTML du bloc élémentaire d'après les templates du thème (layout+element)
        let $item = $( this.makeElementBloc(ref) );
        if (! $item.length) { console.warn("Bloc invalide: aucun bloc élémentaire disponible correspondant (ignoré)", ref); return; }
        
        // intégration des données du JSON dans le DOM du composer
        switch (ref) {
            case "btexte":
                if (opts) {
                    let $elem = $item.find('.bloc-content').addBack('.bloc-content');
                    if (opts.style)   $elem.addClass("style-" + opts.style);
                    if (opts.content) $elem.html(opts.content);
                }
            break;
        }
        return $item;
    };

    /*
     * buildReportDataviz: used to generate composition HTML for a dataviz component
     */
    ModelData.prototype.buildReportDataviz = function (ref, opts) {
        let $item = $('<div>').addClass('dataviz-proxy');
        $item.attr('data-ref', ref);
        $item.text(JSON.stringify(opts));
        return $item;
    };

    /*
     * getColorsList: Retourne une simple liste des codes hexa des couleurs du thème
     */
    ModelData.prototype.getColorsList = function () {
        return Object.getOwnPropertyNames( this.colors ).map(color => color.value);
    };

    /*
     * Public
     */
    return {
        /* used by composer.js & report.js */
        load:   _loadModel,
        /* unused */
        data:   function(model_name) { return _cache[model_name]; },
        exists: function(model_name) { if (model_name in _cache) return (_cache[model_name]) ? true : false; },
    };

})();

models = (function () {
    /*
     * Private
     */

    var _debug = true;

    /*
     * ModelData : Object definition to store templates and parameters for a model
     */
    var ModelData = function() {
        this.ref = "";  // référence utilisée dans les sélecteurs et dans le nom du fichier "model-<ref>.html"
        this.id = "";   // identifiant renseigné dans le modèle HTML chargé par l'attribut id (inutilisé)
        this.colors = ["#e55039", "#60a3bc", "#78e08f", "#fad390"];
        this.page_styles = "";
        this.page_layouts = {};
        this.structure_blocs = {};
        this.element_blocs = {};
        this.dataviz_components = {};
        this._reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');
        this._reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    };

    /*
     * _cache : This var stores all data from already loaded model file
     */
    var _cache = {};

    /*
     * _loadHtml : Load HTML templates and parameters from server model file
     */
    var _loadHtml = function (model_ref, callback) {
        // retourne directement les données du modèle s'il a déjà été chargé
        if (model_ref in _cache) return (callback) ? callback(true, _cache[ model_ref ]) : true;
        
        // sinon analyse du fichier contenant les templates sur le serveur
        $.ajax({
            url: "/static/html/model-" + model_ref + ".html",
            dataType: "html"
        })
        .fail(function (xhr, status, err) {
            console.error("Erreur au chargement du fichier html/model-" + model_ref + ".html :\n", err);
            _cache[ model_ref ] = false;
            if (callback) callback(false, null);
        })
        .done(function (data, status, xhr) {
            if (_debug) console.debug("Chargement du fichier html du modèle '" + model_ref + "' :\n", data);
            const parser = new DOMParser();
            _cache[ model_ref ] = _parseHtml( parser.parseFromString(data, "text/html") );
            _cache[ model_ref ].ref = model_ref;
            if (_debug) console.debug("Récupération des données du modèle '" + model_ref + "' :\n", _cache[ model_ref ]);
            if (callback) callback(true, _cache[ model_ref ]);
        })
    };

    /*
     * _parseHtml : Method used to parse HTML templates and initialize the object
     */
    var _parseHtml = function(html) {
        let data = new ModelData();
        try {
            data.id = html.firstElementChild.id;
            
            // retrieve color palette
            if ('colors' in html.firstElementChild.dataset) {
                data.colors = html.firstElementChild.dataset.colors.split(',');
            }
            
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
            console.error("Impossible de récupérer les données depuis le modèle :\n", error, html);
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
        if (! this.structure_blocs[ref]) {
            if (this.structure_blocs['bcustom']) ref = 'bcustom';
            else return;
        }
        if (! ('wstructure' in this.page_layouts)) return this.structure_blocs[ref];
        
        let $bloc = $( this.structure_blocs[ref] ).find('.bloc-structure').addBack('.bloc-structure');
        return this.page_layouts['wstructure']
            .replaceAll("{{LABEL}}", ($bloc) ? $bloc.data('label') : "")
            .replaceAll("{{DESC}}",  ($bloc) ? $bloc.data('description') : "")
            .replaceAll("{{HTML}}",  this.structure_blocs[ref])
            .replaceAll("{{REF}}",   ref)
        ;
    };

    // retourne le code HTML d'un bloc élémentaire à partir des templates
    ModelData.prototype.makeElementBloc = function(ref) {
        if (! this.element_blocs[ref]) {
            if (this.element_blocs['btexte']) ref = 'btexte';
            else return;
        }
        if (! ('welement' in this.page_layouts)) return this.element_blocs[ref];
        
        let $bloc = $( this.element_blocs[ref] ).find('.bloc-element').addBack('.bloc-element');
        return this.page_layouts['welement']
            .replaceAll("{{LABEL}}", ($bloc) ? $bloc.data('label') : "")
            .replaceAll("{{DESC}}",  ($bloc) ? $bloc.data('description') : "")
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
        
        // génération du HTML du bloc structurant d'après les templates du modèle (layout+structure)
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
        
        // génération du HTML du bloc élémentaire d'après les templates du modèle (layout+element)
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

    /**
     * (ex json2html) convert Dataviz object to html representation  this method is called by admin.js
     * to render dataviz in dataviz form
     * @param  {object} viz
     */
    ModelData.prototype.renderDataviz = function (viz) {
        if (_debug) console.debug("Définition JSON de la dataviz à générer en HTML :\n", viz);
        if (! this.dataviz_components[ viz.type ]) return '[DATAVIZ NOT FOUND: '+ viz.type +']';
        
        let html = this.dataviz_components[ viz.type ].trim();
        if ('wdataviz' in this.page_layouts) html = this.page_layouts['wdataviz'].replaceAll("{{HTML}}", html);
        
        // generate HTML element from the model dataviz template
        let template = document.createElement('template');
        template.innerHTML = html.replace("{{dataviz}}", viz.properties.id);
        let component = template.content.firstChild;
        
        let dataviz = component.querySelector(".dataviz");
        if (! dataviz) return '[DATAVIZ NOT VALID: '+ viz.type +']';
        [...dataviz.classList].forEach((c) => { if (c.startsWith('icon-')) dataviz.classList.remove(c); });
        
        // populate HTML data attributes from JSON properties
        for (const [attribute, value] of Object.entries(viz.properties)) switch (attribute) {
            case "id":
                break;
            case "title":
                component.querySelectorAll(".report-dataviz-title").forEach((el) => {
                    el.innerText = viz.properties.title;
                });
                break;
            case "description":
                component.querySelectorAll(".report-dataviz-description").forEach((el) => {
                    el.innerHTML = viz.properties.description;
                });
                break;
            case "icon":
                dataviz.classList.add("custom-icon");
                dataviz.classList.add(viz.properties.icon);
                break;
            case "iconposition":
                dataviz.classList.add(viz.properties.iconposition);
                break;
            default:
                dataviz.dataset[attribute] = value;
        }
        
        return component;
    };

    /*
     * Public
     */
    return {
        /* used by composer.js, wizard.js, admin.js & report.js */
        load:   _loadHtml,
        /* unused */
        data:   function(model_ref) { return _cache[model_ref]; },
        exists: function(model_ref) { if (model_ref in _cache) return (_cache[model_ref]) ? true : false; },
    };

})();

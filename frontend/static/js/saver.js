saver = (function () {
    /*
     * Private
     */

    var _debug = true;

    const _reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    const _reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');

    /*
     * JSON objects properties for report data
     */

    // Représentation JSON de la composition d'un rapport (constitué d'une suite de JsonBloc)
    var JsonReport = function(data, theme = "") {
        this.theme = theme;
        this.blocs = [];  // liste de JsonBloc
        if (data instanceof Node) this.parseNode(data); else if (data) this.loadJson(data);
    };

    // Représentation JSON d'un bloc composant un rapport (constitué de JsonLayout récursifs)
    var JsonBloc = function(data) {
        this.ref     = "";
        this.title   = "";
        this.layout  = {};  // objet JsonLayout
        this.sources = "";
        if (data instanceof Node) this.parseNode(data); else if (data) this.loadJson(data);
    };

    // Représentation JSON d'une structure de bloc dans un rapport (de type rows, cols, cell ou data)
    var JsonLayout = function(data) {
        this.type = "none";
        this.size = null;
        this.node = null;  // liste de JsonLayout
        this.data = null;  // liste de JsonComponent
        if (data instanceof Node) this.parseNode(data); else if (data) this.loadJson(data);
    };

    // Représentation JSON d'un composant listé dans la structure d'un rapport (dataviz ou element)
    var JsonComponent = function(data) {
        this.type = "none";
        this.ref  = "";
        this.opts = {};
        if (data instanceof Node) this.parseNode(data); else if (data) this.loadJson(data);
    };

    /*
     * JSON objects methods to initialize from backups
     */

    JsonReport.prototype.loadJson = function(json) {
        if (json.theme) this.theme = json.theme;
        if (json.blocs) json.blocs.forEach((data) => { this.blocs.push( new JsonBloc(data) ); });
    };

    JsonBloc.prototype.loadJson = function(json) {
        if (json.ref)     this.ref     = json.ref;
        if (json.title)   this.title   = json.title;
        if (json.layout)  this.layout  = new JsonLayout(json.layout);
        if (json.sources) this.sources = json.sources;
    };

    JsonLayout.prototype.loadJson = function(json) {
        if (json.type) this.type = json.type;
        if (json.size) this.size = json.size;
        if (this.type == 'rows' || this.type == 'cols') {
            this.node = [];
            if (json.node) json.node.forEach((item) => { this.node.push( new JsonLayout(item) ); });
        }
        if (this.type == 'cell' || this.type == 'data') {
            this.data = [];
            if (json.data) json.data.forEach((item) => { this.data.push( new JsonComponent(item) ); });
        }
    };

    JsonComponent.prototype.loadJson = function(json) {
        if (json.type) this.type = json.type;
        if (json.ref)  this.ref  = json.ref;
        if (json.opts) this.opts = json.opts;
    };

    /*
     * JSON object methods to initialize from composer
     */

    JsonReport.prototype.parseNode = function(node) {
        node.querySelectorAll(".structure-item").forEach((data) => {
            this.blocs.push( new JsonBloc(data) );
        });
    };

    JsonBloc.prototype.parseNode = function(node) {
        let elem;
        this.ref = node.dataset.bloc;
        if (elem = node.querySelector(".structure-html .bloc-title"))   this.title   = composer.getTextData(elem);
        if (elem = node.querySelector(".structure-html .bloc-layout"))  this.layout  = new JsonLayout(elem);
        if (elem = node.querySelector(".structure-html .bloc-sources")) this.sources = composer.getTextData(elem);
    };

    JsonLayout.prototype.parseNode = function(node) {
        var result;
        if (result = node.className.match(_reType)) this.type = result[2];  // type depuis classe "layout-*"
        if (result = node.className.match(_reSize)) this.size = result[2];  // size depuis classe "col-*"
        switch (this.type) {
            // récursion sur les structures enfants d'un "layout-rows" ou "layout-cols"
            case 'rows':
            case 'cols':
                this.node = [];
                for (var i = 0; i < node.childElementCount; i++) {
                    let child = new JsonLayout(node.children[i]);
                    if (child && child.type != "none") this.node.push(child);
                }
            break;
            // recherche des "components" (dataviz|element) listés dans le conteneur d'un layout-cell
            case 'cell':
            case 'data':
                this.data = [];
                node.querySelectorAll(".components-container .list-group-item").forEach((item) => {
                    let child = new JsonComponent(item);
                    if (child && child.type != "none") this.data.push(child);
                });
            break;
            // sinon forcer le type "none" qui permettra d'ignorer ce bloc
            default: this.type = "none";
        }
    };

    JsonComponent.prototype.parseNode = function(node) {
        // extraction des données d'un dataviz
        if (node.classList.contains('dataviz-item')) {
            this.type = "dataviz";
            this.ref  = node.dataset.dataviz;
            let code = node.querySelector('code.dataviz-definition');
            try {
                if (code.textContent.length) this.opts = JSON.parse( code.textContent )
            } catch (e) {
                console.error("Configuration du dataviz inutilisable !\n", code, e);
            }
//          if (! this.opts) this.opts = { 'properties': { 'id': ref } };
            return;
        }
        // extraction des données d'un element
        if (node.classList.contains('element-item')) {
            this.type = "element";
            this.ref  = node.dataset.bloc;
            switch (this.ref) {
                case "btexte":
                    this.opts = composer.getTextData( node.querySelector('.element-html .bloc-element .bloc-content') );
                break;
            }
            return;
        }
    };

    /*
     * JSON object methods to return only report data
     */

    JsonReport.prototype.exportJson = function() {
        return JSON.stringify(this);
    };

    JsonReport.prototype.exportData = function() {
        return Object.assign({}, this);
    };

    /**
     * _saveJsonReport : Send report JSON definition to the server (store a new version in database).
     */
    var _saveJsonReport = function (report_id, composition, callback) {
        // Export composition DOM structures and components
        const report_json = new JsonReport(composition, composer.getModelId());
        if (_debug) console.debug("Export JSON de la composition :\n", report_json);
        
        // Request save new report backup data
        $.ajax({
            type: "PUT",
            dataType: "json",
            contentType: "application/json",
            data: report_json.exportJson(),
            url: [report.getAppConfiguration().api, "backup", report_id].join("/")
        })
        .done(function (data, status, xhr) {
            if (_debug) console.debug("Résultat de l'enregistrement :\n", data);
            if (data.response === "success") {
                Swal.fire("Sauvegardé", "Enregistrement de la définition du rapport : " + report_id, 'success');
                if (callback) callback(true);
            } else {
                Swal.fire("Une erreur s'est produite", "La définition du rapport n'a pas pu être enregistrée :<br>" + (data.error || data.response), 'error');
                if (callback) callback(false);
            }
        })
        .fail(function (xhr, status, error) {
            Swal.fire("Une erreur s'est produite", "L'API ne réponds pas :<br>" + _parseError(xhr.responseText), 'error');
            if (callback) callback(false);
        });
    };

    /**
     * _loadJsonReport : Load report JSON definition from the server (last version if available).
     */
    var _loadJsonReport = function (report_id, callback) {
        // Request last report backup data
        $.ajax({
            type: "GET",
            dataType: "json",
            url: [report.getAppConfiguration().api, "backup", report_id, "last"].join("/")
        })
        .done(function (data, status, xhr) {
            if (_debug) console.debug("Résultat du téléchargement JSON :\n", data);
            if (status === 'nocontent') {
                // No database version, try to import from old HTML composer
                _loadHtmlReport(report_id, callback);
            } else if (data.response === "success" && data.report_backups) {
                // Load composition from JSON
                let report_json = new JsonReport(data.report_backups);
                if (_debug) console.debug("Import JSON de la composition :\n", report_json);
                if (callback) callback(true, report_json.exportData());
            } else {
                Swal.fire("Une erreur s'est produite", "La définition du rapport n'a pas pu être chargée :<br>" + (data.error || data.response), 'error');
                if (callback) callback(false);
            }
        })
        .fail(function (xhr, status, err) {
            Swal.fire("Une erreur s'est produite", "L'API ne réponds pas :<br>" + _parseError(xhr.responseText), 'error');
            if (callback) callback(false);
        });
    };

    /**
     * _loadHtmlReport : Load report HTML composer version from the server (old save format).
     */
    var _loadHtmlReport = function (report_id, callback) {
        // Request composer report file
        $.ajax({
            type: "GET",
            url: [report.getAppConfiguration().location, report_id, "report_composer.html?dc=" + Date.now()].join("/")
        })
        .done(function (html, status, xhr) {
            if (_debug) console.debug("Résultat du téléchargement HTML :\n", html);
            if (! html) {
                if (callback) callback(false);
                return;
            }
            // Alter HTML for compatibility with the new composition parser
            let composition = document.createRange().createContextualFragment(
                html.replaceAll('col-md', 'col').replaceAll('editable-text titre-', 'editable-text style-titre-')
            );
            composition.querySelectorAll('.text-edit').forEach(el => el.remove());
            composition.querySelectorAll('.structure-bloc').forEach((bloc) => {
                let rb  = bloc.querySelector('.report-bloc');
                let rbt = bloc.querySelector('.report-bloc-title');
                let ref = (rbt) ? 'btitle' : ((rb) ? rb.className.split(' ').pop() : 'b4-4-4');
                bloc.setAttribute('data-bloc', ref);
                bloc.classList.add('structure-item');
                bloc.classList.remove('structure-bloc');
            });
            composition.querySelectorAll('.report-bloc-title').forEach((div) => {
                div.classList.add('bloc-layout');
                div.classList.add('layout-data');
            });
            composition.querySelectorAll('.bloc-content').forEach((div) => {
                div.classList.remove('bloc-content');
                div.classList.add('bloc-layout');
                div.classList.add('layout-rows');
            });
            composition.querySelectorAll('div.row').forEach((div) => {
                div.classList.add('layout-cols');
            });
            composition.querySelectorAll('.customBaseColumn').forEach((div) => {
                div.classList.add('layout-cell');
            });
            composition.querySelectorAll('.dataviz-container').forEach((div) => {
                div.classList.add('components-container');
            });
            composition.querySelectorAll('.dataviz').forEach((div) => {
                div.classList.add('dataviz-item');
            });
            composition.querySelectorAll('code.dataviz-definition').forEach((div) => {
                let dvzCode = document.createElement('div');
                dvzCode.innerHTML = div.innerText;
                div.textContent = wizard.html2json( dvzCode.querySelector('.dataviz') );
            });
            composition.querySelectorAll('.structure-element.titleBloc').forEach((bloc) => {
                let text = bloc.querySelector('.editable-text').cloneNode(true);
                text.classList.add('bloc-content');
                let tpl = '<div class="structure-html">';
                tpl+= '<div class="bloc-layout layout-rows"><div class="layout-cols"><div class="layout-cell col-12">';
                tpl+= '<ul class="components-container"><li class="element-item list-group-item" data-bloc="btexte">';
                tpl+= '<div class="element-html"><div class="bloc-element">';
                tpl+= text.outerHTML;
                tpl+= '</div></div></li></ul></div></div></div></div></div>';
                bloc.classList.add('structure-item');
                bloc.dataset.bloc = "bsimple";
                bloc.innerHTML = tpl;
            });
            if (_debug) console.debug("Import HTML de la composition :\n", composition);
            
            // Load composition from HTML
            let report_json = new JsonReport(composition);
            if (_debug) console.debug("Import JSON de la composition :\n", report_json);
            if (callback) callback(true, report_json.exportData());
        })
        .fail(function (xhr, status, err) {
            Swal.fire("Une erreur s'est produite", "L'API ne réponds pas :<br>" + _parseError(xhr.responseText), 'error');
        });
    };

    /*
     * Public
     */
    return {
        /* used by composer.js */
        saveJsonReport: _saveJsonReport,
        /* used by composer.js & report.js */
        loadJsonReport: _loadJsonReport,
    };

})();

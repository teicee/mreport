saver = (function () {
    /*
     * Private
     */

    const _reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    const _reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');

    class JsonReport {
        constructor(node) {
            this.title = $("#composer-report-title").text(),
            this.theme = composer.activeModel().id;
            this.blocs = [];
            if (node) this.parseNode(node);
        }
        parseNode(node) {
            for (let i = 0; i < node.childElementCount; i++) {
                const child = node.children[i];
                const blocRef = child.dataset.bloc;
                if (blocRef) this.blocs.push(new JsonBloc(blocRef, child));
            }
        }
    }

    class JsonBloc {
        constructor(ref, node) {
            this.ref     = ref;
            this.title   = "";
            this.layout  = {};
            this.sources = "";
            if (node) this.parseNode(node);
        }
        parseNode(node) {
            var elem;
            if (elem = node.querySelector(".bloc-html .bloc-title"))   this.title   = composer.getTextData(elem);
            if (elem = node.querySelector(".bloc-html .bloc-layout"))  this.layout  = new JsonLayout(elem);
            if (elem = node.querySelector(".bloc-html .bloc-sources")) this.sources = composer.getTextData(elem);
        }
    }

    class JsonLayout {
        constructor(node) {
            this.type    = "none";
            this.size    = null;
            this.node    = null;
            this.data    = null;
            if (node) this.parseNode(node);
        }
        parseNode(node) {
            var result;
            // ignore les nodes qui n'ont pas de classe "layout-*"
            if (result = node.className.match(_reType)) this.type = result[2];
            // récupération de la taille depuis une classe "col-*"
            if (result = node.className.match(_reSize)) this.size = result[2];
            // récursion sur les structures enfants d'un "layout-rows" ou "layout-cols"
            switch (this.type) {
                case 'none': return;
                case 'rows':
                case 'cols': return this.parseNodeLayout(node);
                default    : return this.parseNodeComponents(node);
            }
        }
        parseNodeLayout(node) {
            this.node = [];
            for (var i = 0; i < node.childElementCount; i++) {
                let child = new JsonLayout(node.children[i]);
                if (child && child.type != "none") this.node.push(child);
            }
        }
        // recherche des "components" (dataviz|element) listés dans le conteneur d'un layout-cell
        parseNodeComponents(node) {
            this.data = [];
            node.querySelectorAll(".component-container .list-group-item").forEach((item) => {
                if      (item.classList.contains('dataviz-bloc')) this.parseNodeComponentsDataviz(node);
                else if (item.classList.contains('element-bloc')) this.parseNodeComponentsElement(node);
            });
        }
        // extraction des données d'un dataviz
        parseNodeComponentsDataviz(item) {
            let dvzCode, dvzJson;
            try {
                dvzCode = item.querySelector('code.dataviz-definition').textContent;
                dvzJson = (dvzCode) ? JSON.parse(dvzCode) : { properties: { id: item.dataset.dataviz } };
                this.data.push( dvzJson );
            } catch (e) {
                console.error(e, dvzCode);
            }
        }
        // extraction des données d'un element
        parseNodeComponentsElement(item) {
            let txtBloc, txtJson;
            try {
                txtBloc = item.querySelector('.bloc-html .bloc-element .bloc-content');
                txtJson = composer.getTextData(txtBloc);
                txtJson.ref = item.dataset.bloc;
                this.data.push( txtJson );
            } catch (e) {
                console.error(e, "Invalid text element !");
            }
        }
    }

    /**
     * _saveJsonReport : Send report JSON definition to the server (store a new version in database).
     */
    var _saveJsonReport = function (report_id, composition) {
        // Export composition DOM structures and components
        const report_data = new JsonReport(composition);
        console.debug("Export JSON de la composition :", report_data);
        
        // Request save new report backup data
        $.ajax({
            type: "PUT",
            dataType: "json",
            contentType: "application/json",
            data: JSON.stringify(report_data),
            url: [report.getAppConfiguration().api, "backup", report_id].join("/")
        })
        .done(function (data, status, xhr) {
            console.debug(data);
            if (data.response === "success") {
                Swal.fire(
                    "Sauvegardé",
                    "Enregistrement de la définition du rapport : " + report_id,
                    'success',
                );
            } else {
                Swal.fire(
                    "Une erreur s'est produite",
                    "La définition du rapport n'a pas pu être enregistrée :<br>" + (data.error || data.response),
                    'error'
                );
            }
        })
        .fail(function (xhr, status, error) {
            Swal.fire(
                "Une erreur s'est produite",
                "L'API ne réponds pas :<br>" + _parseError(xhr.responseText),
                'error'
            );
        });
    };


/*
    var _json2composition = function (jsonReport) {
                case "BlocTitle": // { 'type': b.type, 'title': b.title }
                    //create model container
                    // bad way. Need to update. Not sure that first element template is title
                    // Caution with composer.templates.structureTemplate
                    _composer_template = composer.models()[model].elements[0];
                    //add dataviz template to container
                    //Same than composer.js
                    let dvz = jsonReport.configuration[bloc.title];
                    let dvztpl = composer.templates.datavizTemplate.join("");
                    dvztpl = dvztpl.replace(/{{dvz}}/g, bloc.title);
                    dvztpl = dvztpl.replace(/{{id}}/g, bloc.title);
                    //dvztpl = dvztpl.replace(/{{reportId}}/g, reportId);
                    dvztpl = dvztpl.replace(/{{type}}/g, dvz.dataviz_class);
                    dvztpl = dvztpl.replace(/{{icon}}/g, composer.getDatavizTypeIcon(dvz.dataviz_class));
                    //Create Element based on composer dataviz template
                    let dvzConfig = parser.parseFromString(dvztpl, "text/html").querySelector("li");
                    //Populate dataviz-definition with dataviz outerHTML element
                    let dvzElement = parser.parseFromString(composer.models()[model].dataviz_components.title.replace("{{dataviz}}",bloc.title), "text/html").querySelector("div");
*/

    /**
     * _parseJsonStructure: 
     */
    var _parseJsonStructure = function (layout, $node) {
        // traitement d'un noeud "data" avec sa liste de dataviz
        if (layout.type == 'data') {
            let $container = $node.find('.component-container').first();
            if (layout.data) layout.data.forEach(function (dvzData) {
                const $dataviz = composer.makeDataviz(dvzData);
                if (! $dataviz) return;
                if (! $container.length) console.warn("Aucun conteneur pour dataviz");
                $container.append($dataviz);
            });
            return;
        }
        // traitement d'un noeud "rows" ou "cols" avec sa liste d'enfants
        if (layout.type == 'rows' || layout.type == 'cols') {
            let $children = $node.children('.layout-rows, .layout-cols, .layout-cell, .layout-data');
            let childIdx = 0;
            if (layout.node) layout.node.forEach(function (child) {
                let $child = (childIdx < $children.length) ? $( $children[childIdx++] ) : $('<div>').appendTo( $node );
                
                // nettoyage des classes ('col-#', 'layout-#' et 'row')
                let nodeCsize = child.size || 1;
                let nodeClass = $child.attr('class') || '';
                $child.attr('class', nodeClass.replace(_reSize, '$1$3').replace(_reType, '$1$3')).removeClass('col row');
                
                if ('type' in child) switch(child.type) {
                    case 'rows':
                        $child.addClass('layout-rows col-' + nodeCsize);
                        _parseJsonStructure(child, $child);
                    break;
                    case 'cols':
                        $child.addClass('layout-cols row');
                        _parseJsonStructure(child, $child);
                    break;
                    case 'data':
                        $child.addClass('layout-data');
                        _parseJsonStructure(child, $child);
                    break;
                    case 'cell':
                        $child.replaceWith( composer.makeCell(nodeCsize, child.data) );
                        if (child.node) console.warn("Layout invalide: présence d'enfants dans un noeud terminal (ignorés)", child.node);
                    break;
                    default:
                        console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", child.type);
                }
            });
            return;
        }
        console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", layout.type);
    };

    /**
     * _json2composition : Import JSON report data to composition DOM structures.
     */
    var _json2composition = function (jsonReport) {
        // sélection dans le composer du thème enregistré
        if (jsonReport.theme) {
            $("#selectedModelComposer").val( jsonReport.theme ).trigger('change');
        }
        // traitement des blocs définis pour génération du DOM de composition
        if (jsonReport.blocs) jsonReport.blocs.forEach( function (bloc) {
            const blocType = bloc.type || '';  // TODO gestion du type "element"
            const blocRef  = bloc.ref  || '';
            
            // génération du HTML du bloc structurant en clonant l'élément disponible dans la sidebar
            var $structure = $('#structure-models .structure-bloc[data-bloc="' + blocRef + '"]').clone();
            if (! $structure.length) return console.warn("Bloc invalide: aucun bloc disponible correspondant (ignoré)", blocRef);
            
            // nettoyage des conteneurs non-structurant de la composition
            $structure.find('.cols-tools, .cell-tools, .text-edit').remove();
            $structure.find('.layout-cell .component-container').remove();
            
            // intégration des données du JSON dans le DOM du composer
            if ('title' in bloc) $structure.find('.bloc-html .bloc-title h4').text( bloc.title );  // TODO
            if ('layout' in bloc) _parseJsonStructure(bloc.layout, $structure.find('.bloc-html .bloc-layout'));
            if ('sources' in bloc) $structure.find('.bloc-html .bloc-sources p').html( bloc.sources );  // TODO
            
            // mise en place du bloc dans l'interface de composition
            console.debug("Contenu HTML du bloc fabriqué à partir de l'objet Report :", $structure.first());
            composer.loadBloc( $structure );
        });
    };

    /**
     * _loadJsonReport : Load report JSON definition from the server (last version if available).
     */
    var _loadJsonReport = function (report_id) {
        // Request last report backup data
        $.ajax({
            type: "GET",
            dataType: "json",
            url: [report.getAppConfiguration().api, "backup", report_id, "last"].join("/")
        })
        .done(function (data, status, xhr) {
            console.debug(data);
            if (status === 'nocontent') {
                // No database version, try to import from old HTML composer
                _loadHtmlReport(report_id);
            } else if (data.response === "success" && data.report_backups) {
                // Load composition from JSON
                _json2composition(data.report_backups);
            } else {
                Swal.fire(
                    "Une erreur s'est produite",
                    "La définition du rapport n'a pas pu être chargée :<br>" + (data.error || data.response),
                    'error'
                );
            }
        })
        .fail(function (xhr, status, err) {
            Swal.fire(
                "Une erreur s'est produite",
                "L'API ne réponds pas :<br>" + _parseError(xhr.responseText),
                'error'
            );
        });
    };

    /**
     * _loadHtmlReport : Load report HTML composer version from the server (old save format).
     */
    var _loadHtmlReport = function (report_id) {
        // Request composer report file
        $.ajax({
            type: "GET",
            url: [report.getAppConfiguration().location, report_id, "report_composer.html?dc=" + Date.now()].join("/")
        })
        .done(function (html, status, xhr) {
            console.debug(html);
            if (! html) return;
            
            // Alter HTML for compatibility with the new composition parser
            let composition = document.createRange().createContextualFragment(
                html.replaceAll('col-md', 'col')
            );
            composition.querySelectorAll('.structure-bloc').forEach( function(div){
                let rb = div.querySelector('.report-bloc');
                let bloc = (rb) ? rb.className.split(' ').pop() : 'b4-4-4';
                div.setAttribute('data-bloc', bloc);
            });
            composition.querySelectorAll('.bloc-layout').forEach( function(div){
                div.classList.add('layout-rows');
            });
            composition.querySelectorAll('div.row').forEach( function(div){
                div.classList.add('layout-cols');
            });
            composition.querySelectorAll('.customBaseColumn').forEach( function(div){
                div.classList.add('layout-cell');
            });
            composition.querySelectorAll('code.dataviz-definition').forEach( function(div){
                let dvzCode = document.createElement('div');
                dvzCode.innerHTML = div.textContent;
                div.textContent = wizard.html2json( dvzCode.querySelector('.dataviz') );
            });
            console.debug(composition);
            
            // Save composition to JSON and load it
            _json2composition(_composition2json(composition));
        })
        .fail(function (xhr, status, err) {
            Swal.fire(
                "Une erreur s'est produite",
                "L'API ne réponds pas :<br>" + _parseError(xhr.responseText),
                'error'
            );
        });
    };


    /*
     * Public
     */
    return {
        saveJsonReport: _saveJsonReport,
        loadJsonReport: _loadJsonReport,
    }; // fin return

})();

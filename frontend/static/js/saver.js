saver = (function () {
    /*
     * Private
     */

    const _reType = new RegExp('^(.* )?layout-(cell|cols|rows)( .*)?$');
    const _reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');

    class JsonReport {
        constructor() {
            this.title = $("#composer-report-title").text(),
            this.theme = composer.activeModel().id;
            this.blocs = [];
        }
    }

    class JsonBloc {
        constructor(ref) {
            this.ref     = ref;
            this.type    = "bloc";
            this.title   = {};
            this.layout  = {};
            this.sources = "";
        }
    }


/*
        // Loop on dataviz definitions
            properties = dvz_element.dataset;
            properties.dataviz_class = dvz_element.className.match(/report-*(chart|figure|text|table|map|title|image|iframe)/)[1];

            let bloc_type = bloc_item.className.match(/structure-*(bloc|element)/)[1];
            if (bloc_type === "bloc") {
                //report-bloc
                    _bloc.model = bloc.getAttribute("data-model-title").trim();
                    //get bloc-sources if present
                    let title = bloc.querySelector(".bloc-title.editable-text");
                    if (title && title.firstChild && title.firstChild.nodeType === 3 && title.firstChild.textContent) {
                        let style = false;
                        if (title.className.match(/titre-\d/)) {
                            style = title.className.match(/titre-\d/)[0];
                        }
                        _bloc.title = { "title": title.firstChild.textContent.trim(), "style": style };
                    }
                    //get bloc-sources if present
                    let sources = bloc.querySelector(".bloc-sources .editable-text");
                    if (sources && sources.firstChild && sources.firstChild.nodeType === 3 && sources.firstChild.textContent) {
                        _bloc.sources = sources.firstChild.textContent.trim();
                    }
                } else {
                    // bloc-title
                    let bloc = bloc_item.querySelector(".report-bloc-title");
                    if (bloc) {
                        let dataviz = bloc.querySelector(".dataviz");
                        if (dataviz && dataviz.dataset && dataviz.dataset.dataviz) {
                            blocs.push(new BlocTitle(dataviz.dataset.dataviz));
                        }
                    }
                }
            } else {
                if (bloc_item.classList.contains("titleBloc")) {
                    let t = bloc_item.querySelector(".editable-text");
                    if (t && t.firstChild && t.firstChild.nodeType === 3 && t.firstChild.textContent) {
                        let style = false;
                        if (t.className.match(/titre-\d/)) {
                            style = t.className.match(/titre-\d/)[0];
                        }
                        blocs.push(new BlocElement(t.firstChild.textContent.trim(), style));
                    }
                }
            }
*/

    /**
     * _parseHtmlLayout: parcours en profondeur (récursif) de la structure d'un bloc pour export HTML vers JSON
     */
    var _parseHtmlLayout = function (node) {
        let structure = {}, result;
        
        // ignore les nodes qui n'ont pas de classe "layout-*"
        result = node.className.match(_reType);
        if (result !== null) structure.type = result[2];
        else return;
        
        // récupération de la taille depuis une classe "col-*"
        result = node.className.match(_reSize);
        if (result !== null) structure.size = result[2];
        
        if (structure.type !== 'cell') {
            // récursion sur les structures enfants d'un "layout-rows" ou "layout-cols"
            structure.node = [];
            for (var i = 0; i < node.childElementCount; i++) {
                result = _parseHtmlLayout(node.children[i]);
                if (result) structure.node.push(result);
            }
            if (! structure.node.length) delete structure.node;
        } else {
            // recherche des dataviz listées dans le conteneur d'un layout-cell
            structure.data = [];
            node.querySelectorAll(".dataviz-container .dataviz").forEach(function (dvz) {
                const dvzCode = dvz.querySelector('code.dataviz-definition').textContent;
                const dvzJson = (dvzCode) ? JSON.parse(dvzCode) : { properties: { id: dvz.dataset.dataviz } };
                structure.data.push( dvzJson );
            });
        }
        return structure;
    }

    /**
     * _composition2json : Export composition DOM structures to JSON report data.
     */
    var _composition2json = function (composition) {
        let jsonReport = new JsonReport();
        
        // Loop on blocs
        for (let i = 0; i < composition.childElementCount; i++) {
            const child  = composition.children[i];
            const blocRef = child.dataset.bloc;
            if (blocRef) {
                let jsonBloc = new JsonBloc(blocRef);
                jsonBloc.type    = child.className.match(/structure-(bloc|element)/)[1];
                jsonBloc.title   = child.querySelector(".structure-html .bloc-title h4").textContent;
                jsonBloc.layout  = _parseHtmlLayout(child.querySelector(".structure-html .bloc-content"));
                jsonBloc.sources = child.querySelector(".structure-html .bloc-sources p").innerHtml;
                jsonReport.blocs.push(jsonBloc);
            }
        }
        console.debug("Objet Report créé à partir de la composition :", jsonReport);
        return jsonReport;
    };

    /**
     * _saveJsonReport : Send report JSON definition to the server (store a new version in database).
     */
    var _saveJsonReport = function (report_id, composition) {
        // Save composition to JSON
        const report_data = _composition2json(composition);
        
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
                    // Caution with composer.templates.blockTemplate
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
        let childIdx = 0;
        let $children = $node.children('.layout-cell, .layout-cols, .layout-rows');
        
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
                case 'cell':
                    $child.replaceWith( composer.makeCell(nodeCsize, child.data) );
                    if (child.node) console.warn("Layout invalide: présence d'enfants dans un noeud terminal (ignorés)", child.node);
                break;
                default:
                    console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", child.type);
            }
        });
        if (layout.data) console.warn("Layout invalide: définitions de dataviz inattendues (ignorées)", layout.data);
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
            const blocType = bloc.type || '';  // TODO type bloc ou element (texte) ?
            const blocRef  = bloc.ref  || '';
            
            // génération du HTML du bloc structurant en clonant l'élément disponible dans la sidebar
            var $structure = $('#structure-models .structure-bloc[data-bloc="' + blocRef + '"]').clone();
            if (! $structure.length) return console.warn("Bloc invalide: aucun bloc disponible correspondant (ignoré)", blocRef);
            
            // nettoyage des conteneurs non-structurant de la composition
            // TODO tout ce qui est dans bloc-content mais sans classe layout ?
            $structure.find('.cols-tools, .cell-tools').remove();
            $structure.find('.dataviz-container').remove();
            
            // intégration des données du JSON dans le DOM du composer
            if ('title' in bloc) $structure.find('.structure-html .bloc-title h4').text( bloc.title );  // TODO
            if ('layout' in bloc) _parseJsonStructure(bloc.layout, $structure.find('.structure-html .bloc-content'));
            if ('sources' in bloc) $structure.find('.structure-html .bloc-sources p').html( bloc.sources );  // TODO
            
            // mise en place du bloc dans l'interface de composition
            console.debug("Contenu HTML du bloc fabriqué à partir de l'objet Report :", $structure.first());
            composer.addBloc( $structure );
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
            if (status === 'nocontent') return;
            if (data.response === "success" && data.report_backups) {
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


    /*
     * Public
     */
    return {
        saveJsonReport: _saveJsonReport,
        loadJsonReport: _loadJsonReport,
    }; // fin return

})();

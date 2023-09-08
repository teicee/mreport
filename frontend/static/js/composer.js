composer = (function () {
    /*
     * Private
     */

    const _reTest = new RegExp('^(.* )?layout-(cell|rows)( .*)?$');
    const _reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    const _reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');

    /*
     * _composerTemplates - {object}. This var store html templates to render composer structure and actions buttons.
     */
    var _composerTemplates = {
        // HTML used to construct structural blocks and append it to dom in #structure-models list
        structureTemplate: [
            '<li class="structure-bloc list-group-item handle" data-bloc="{{REF}}">',
              '<div class="bloc-tools btn-group btn-group-sm">',
                '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-danger bloc-remove"><i class="fas fa-times"></i> <b>supprimer</b></button>',
              '</div>',
              '<span class="bloc-label"><i class="fas fa-arrows-alt"></i> {{LABEL}}</span>',
              '<div class="bloc-html">{{HTML}}</div>',
            '</li>'
        ].join(""),
        // HTML used to construct elements components and append it to dom in #element-models list
        elementTemplate: [
            '<li class="element-bloc list-group-item handle" data-bloc="{{REF}}">',
              '<div class="data-tools btn-group btn-group-sm">',
//              '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-danger bloc-remove"><i class="fas fa-times"></i> <b>supprimer</b></button>',
              '</div>',
              '<span class="bloc-label"><i class="fas fa-arrows-alt"></i> {{LABEL}}</span>',
              '<div class="bloc-html">{{HTML}}</div>',
            '</li>'
        ].join(""),
        // HTML used to construct dataviz components and append them to dom in #dataviz-items list
        datavizTemplate: [
            '<li class="dataviz-bloc list-group-item handle" data-dataviz="{{REF}}" data-type="{{TYPE}}" title="{{REF}}">',
              '<div class="data-tools btn-group btn-group-sm">',
//              '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-warning edit" data-toggle="modal" data-component="report" data-related-id="{{REF}}" data-target="#wizard-panel"><i class="fas fa-cog"></i> <b>éditer</b></button>',
                '<button class="btn btn-danger bloc-remove"><i class="fas fa-times"></i> <b>supprimer</b></button>',
              '</div>',
              '<span class="dataviz-label"><i class="dvz-icon {{ICON}}" title="{{TYPE}}"></i> {{LABEL}}</span>',
              '<code class="dataviz-definition"></code>',
            '</li>'
        ].join(""),
        
        // HTML used to add action buttons to divided cells
        cols_tools: [
            '<div class="cols-tools btn-group btn-group-sm">',
              '<button class="btn btn-warning" data-toggle="modal" data-target="#composer_grid_form">',
                '<i class="fas fa-grip-horizontal"></i> <b>grid</b>',
              '</button>',
            '</div>',
        ].join(""),
        cell_tools: [
            '<div class="cell-tools btn-group btn-group-sm">',
              '<button class="btn btn-success cell-divide">',
                '<i class="fas fa-columns"></i> <b>diviser</b>',
              '</button>',
              '<button class="btn btn-warning cell-empty">',
                '<i class="fas fa-undo"></i> <b>vider</b>',
              '</button>',
              '<button class="btn btn-danger cell-delete">',
                '<i class="fas fa-trash"></i> <b>supprimer</b>',
              '</button>',
            '</div>',
        ].join(""),
        // HTML used to add action buttons to editable texts
        editable_element: [
            '<button data-toggle="modal" data-target="#text-edit" class="btn btn-sm btn-warning text-edit">',
              '<i class="fas fa-edit"></i> <b>éditer</b>',
            '</button>'
        ].join(""),
        // HTML used to add a new child column inside a structure block
        layout_cell: [
            '<div class="col-{{SIZE}} layout-cell">',
              '<ul class="component-container list-group"></ul>',
            '</div>'
        ].join(""),
        // HTML used to add a new input for colunm size in the division form
        grid_col_input: [
            '<div class="col">',
              '<input type="number" min="1" max="12" class="form-control" placeholder="col-size" value="{{VAL}}" />',
            '</div>'
        ].join(""),
        // HTML used for the add new column button in the division form
        grid_col_adder: [
            '<div class="col" style="flex-grow:0;">',
              '<button type="button" id="grid-add-col" class="btn btn-success" title="Ajouter une colonne"><i class="fas fa-plus"></i></button>',
            '</div>'
        ].join(""),
    };

    var _getDatavizTypeIcon  = function (type) {
        switch (type) {
            case "chart":  return "fas fa-chart-bar";
            case "table":  return "fas fa-table";
            case "figure": return "fas fa-sort-numeric-down";
            case "title":  return "fas fa-heading";
            case "map":    return "fas fa-map-marker-alt";
            case "image":  return "fas fa-image";
            case "iframe": return "fas fa-external-link-alt";
            case "text":   return "fas fa-comment";
        }
        return 'fas fa-arrows-alt';
    };

    /*
     * _listTemplates - {object}. List available templates.
     * TODO use config file (ask the backend?)
     */
    var _listTemplates = {
        "composer": "",
        "a":        "Modèle A",
        "b":        "Modèle B",
    };

    /*
     * _HTMLTemplates - {object}. This var store structured html blocks issued
     * from html template selected
     */
    var _HTMLTemplates = {};

    /*
     * _activeHTMLTemplate - string. This var store template selected id
     */
    var _activeHTMLTemplate = "";

    /*
     * _onSelectTemplate: Update style and icons store derived from selected template
     * method linked to #selectedModelComposer change event
     */
    var _onSelectTemplate = function (e) {
        _activeHTMLTemplate = $(this).val();
        /*
        // NOTE inutilisé pour ne charger les css du template que lorsque le wizard est ouvert
        // NOTE wizard peut ne pas encore être initialisé et fonctionnel !
        if (_activeHTMLTemplate && wizard.ready()) {
            // update style in wizard modal
            wizard.updateStyle(_HTMLTemplates[_activeHTMLTemplate]);
            // update icon store in wizard modal
            wizard.updateIconList(_HTMLTemplates[_activeHTMLTemplate]);
        }
        */
    };

    /*
     * _parseTemplate. Method used to parse HTML template and store to _HTMLTemplates
     */
    var _parseTemplate = function (templateId, html) {
        // get data- linked to the template
        var parameters = $(html).data(); /* eg data-colors... */
        if (parameters.colors) parameters.colors = parameters.colors.split(",");
        
        //get style
        var page_style = $(html).find("style")[0];
        if (page_style) page_style = page_style.outerHTML;
        
        //get main template div
        var page_layout = $(html).find("template.report").get(0).content.firstElementChild.outerHTML;
        
        //get all report-structure & report-element blocs
        var structure_blocs = {};
        $(html).find("template.report-structure").each(function (id, template) {
            structure_blocs[ template.id ] = $(template).prop('content').firstElementChild;
        });
        var element_blocs = {};
        $(html).find("template.report-element").each(function (id, template) {
            element_blocs[ template.id ] = $(template).prop('content').firstElementChild;
        });
        
        //Retrieve all dataviz components
        var dataviz_components = {};
        $(html).find("template.report-component.dataviz").each(function (id, template) {
            let bloc = $(template).prop('content').firstElementChild;
            dataviz_components[ template.dataset.ref ] = $(template).prop('content').firstElementChild.outerHTML;
        });
        
        //Populate _HTMLTemplates with object
        _HTMLTemplates[templateId] = {
            id:                 templateId,
            parameters:         parameters,
            style:              page_style,
            page:               page_layout,
            structure_blocs:    structure_blocs,
            element_blocs:      element_blocs,
            dataviz_components: dataviz_components
        };
    };

// ============================================================================= Initialisation du composer

    /*
     * _initComposerBlocks - Update structure elements choice in composer page
     */
    var _initComposerBlocks = function () {
        const $structures = $("#structure-models").remove('.list-group-item');
        const $elements   = $("#element-models").remove('.list-group-item');
        
        // generate structures blocks from composer template
        for (var ref in _HTMLTemplates['composer'].structure_blocs) {
            const bloc = _HTMLTemplates['composer'].structure_blocs[ref];
            $structures.append(
                _composerTemplates.structureTemplate
                .replaceAll("{{LABEL}}", bloc.getAttribute("data-label"))
                .replaceAll("{{HTML}}",  bloc.outerHTML)
                .replaceAll("{{REF}}",   ref)
            );
        };
        _initComposerTools($structures);
        
        // generate elements blocks from composer template
        for (var ref in _HTMLTemplates['composer'].element_blocs) {
            const bloc = _HTMLTemplates['composer'].element_blocs[ref];
            $elements.append(
                _composerTemplates.elementTemplate
                .replaceAll("{{LABEL}}", bloc.getAttribute("data-label"))
                .replaceAll("{{HTML}}",  bloc.outerHTML)
                .replaceAll("{{REF}}",   ref)
            );
        };
        _initComposerTools($elements);
    };

    /*
     * _initComposerTools - Add composer action buttons to the edited structures
     * NOTE: à appliquer après l'insertion dans le composer (pour le check de profondeur)
     */
    var _initComposerTools = function ($el) {
        // boutons d'action sur textes éditables
        $el.find(".editable-text").addBack(".editable-text").prepend(_composerTemplates.editable_element);
        // boutons d'action sur groupe de colonnes
        $el.find(".layout-cols").addBack(".layout-cols").prepend(_composerTemplates.cols_tools);
        // boutons d'action sur colonnes finales (cellules)
        $el.find(".layout-cell").addBack(".layout-cell").each(function(){
            $(this).prepend(_composerTemplates.cell_tools);
            // retrait du bouton de division si profondeur max atteinte (possible jusqu'à 4x4)
            if ($(this).parentsUntil('.bloc-layout', '.layout-cols').length > 2) $(this).find('.cell-divide').remove();
        });
        return $el;
    };

    /*
     * _initComponentContainer - Configure container to be able to receive dataviz|element.
     */
    var _initComponentContainer = function ($el, noempty) {
        $el.find(".component-container").each(function(i) {
            if (! noempty) $(this).empty();
            // drop component behaviors (dataviz or element)
            new Sortable(this, {
                group: 'component',
                filter: '.btn:not(.drag)',
                onAdd: function (evt) {
                    let $item = $(evt.item);
                    // mise en place d'un component dataviz
                    if ($item.hasClass("dataviz-bloc")) {
                        // Test if title component
                        if ($item.closest(".component-container").hasClass("dataviz-autoconfig")) {
                            // No wizard needed. autoconfig this dataviz & deactivate wizard for this dataviz
                            var dataviz = $item.closest(".dataviz-bloc").attr("data-dataviz");
                            // Inject dataviz definition directly
                            $item.find("code.dataviz-definition").text('{ "type": "title", "properties": {"id": "'+ dataviz +'"} }');
                            // Set title icon & deactivate wizard button
                            $item.find(".dataviz-label .dvz-icon").attr("class", "dvz-icon fas fa-heading");
                            $item.find(".data-tools .btn.edit").hide();
                        } else {
                            $item.find(".data-tools .btn.edit").show();
                        }
                    }
                }
            });
            // init existing dataviz for wizard
            for (let dvz of this.getElementsByClassName("dataviz-bloc")) wizard.getSampleData(dvz.dataset['dataviz']);
            if ($(this).hasClass("dataviz-autoconfig")) $(this).find(".data-tools .btn.edit").hide();
        });
        return $el;
    };

    /*
     * _initComposer. This method initializes composer by loading html templates.
     */
    var _initComposer = function () {
        // update left menu after model selection with linked structure elements
        $("#selectedModelComposer").on('change', _onSelectTemplate);
        // update left menu after report selection with linked dataviz
        $("#selectedReportComposer").on('change', _onSelectReport);

        // Load html templates from server file
        for (const templateId in _listTemplates) {
            if (templateId in _HTMLTemplates) continue;
            $.ajax({
                dataType: "text",
                url: "/static/html/model-" + templateId + ".html"
            })
            .done(function (data, status, xhr) {
                _parseTemplate(templateId, data);
                // if composer template: generate structures blocks list
                if (templateId == 'composer') return _initComposerBlocks();
                // else add the choice to the selector (and select it if none selected yet)
                $("#selectedModelComposer").append('<option value="' + templateId + '">' + _listTemplates[templateId] + '</option>');
                // auto-select the first loaded model
                if (! _activeHTMLTemplate) $("#selectedModelComposer").val(templateId).trigger('change');
            })
            .fail(function (xhr, status, err) {
                _alert("Erreur avec le fichier html/model-" + templateId + ".html " + err, "danger", true);
            });
        };

        // save report buttons (json)
        $("#save_report_json").on('click', function(e){
            const report_id = $("#selectedReportComposer").val();
            if (report_id) saver.saveJsonReport(report_id, document.getElementById("report-composition"));
        });

        // remove/empty actions
        $('#report-composition').on('click', '.bloc-tools .bloc-remove, .data-tools .bloc-remove', function(e){
            const $bloc = $(e.currentTarget).closest(".structure-bloc, .element-bloc, .dataviz-bloc");
//          $bloc.find(".dataviz-bloc").appendTo("#dataviz-items");
            $bloc.remove();
        });
        $('#report-composition').on('click', '.cell-tools .cell-empty', function(e){
            const $data = $(e.currentTarget).closest(".layout-cell").find('.component-container');
//          $data.find(".dataviz-bloc").appendTo("#dataviz-items");
            $data.empty();
        });
        $('#report-composition').on('click', '.cell-tools .cell-delete', function(e){
            const $cell = $(e.currentTarget).closest(".layout-cell");
            const $cols = $cell.closest(".layout-cols");
            const $rows = $cols.closest(".layout-rows");
//          $cell.find(".dataviz-bloc").appendTo("#dataviz-items");
            $cell.remove();
            
            // ajustements sur le layout-cols selon son nombre d'enfants (layout-cell ou layout-rows)
            var $others = $cols.children('.layout-cell, .layout-rows');
            if ($others.length == 0) $cols.remove();
            else if ($others.length == 1) {
                // remplacer la classe de largeur "col-##" en "col-12"
                $others.attr('class',$others.attr('class').replace(_reSize, '$1col-12$3'));
            }
            // nettoyage des conteneurs superflus (rows-# / cols / rows|cell-12 => rows|cell-#)
            var $others = $rows.children('.layout-cols').children('.layout-cell, .layout-rows');
            if ($others.length == 1) {
                // le layout-rows grand-parent récupère directement le contenu de l'unique petit-enfant layout-rows|layout-cell
                var $contents = $others.children().detach();
                $rows.empty().append($contents);
                $rows.removeClass("layout-rows").addClass($others.hasClass("layout-rows") ? "layout-rows" : "layout-cell");
            }
        });

        /*
         * Ajout d'un niveau de découpage à partir d'un layout-cell devenant un layout-rows (contenant 2 rows)
         * Attention: valable uniquement pour un layout-cell ayant déjà des frères (layout-cell ou layout-rows) !
         * Sinon si le layout-cols parent ne contient que cet unique layout-cell (en col-12)...
         * - soit action divide disabled (utiliser action grid sur le layout-cols parent pour étendre rows ou cols)
         * - soit ajout d'une row (layout-cols) plutôt que split du layout-cell
         * - soit split vertical du layout-cell, càd ajout d'une col (layout-cell) => choix le plus attendu
         */
        $('#report-composition').on('click', '.cell-tools .cell-divide', function(e){
            const $cell = $(e.currentTarget).closest(".layout-cell");
            if ($cell.siblings('.layout-cell, .layout-rows').length) {
                $cell.removeClass("layout-cell").addClass("layout-rows");
                $cell.find(".cell-tools").remove();
                $cell.wrapInner('<div class="row layout-cols"><div class="col-12 layout-cell"></div></div>');
                $cell.append(_initComponentContainer($cell.find(".layout-cols").clone()));
                _initComposerTools($cell);
            } else {
                $cell.removeClass("col-12").addClass("col-6");
                $cell.after(_initComponentContainer($cell.clone()));
            }
        });

        // configure modal to divide cells
        $('#composer_grid_form').on('show.bs.modal', _gridOpenForm);
        $('#grid-columns-size').on('click', '#grid-add-col', _gridAddNewCol);
        $('#grid-validate').on('click', _gridValidate);

        // configure modal to edit text
        $('#text-edit').on('show.bs.modal', _onTextEdit);
        $('#text-validate').on('click', _textValidate);

        // configure #structure-models to allow drag with clone option
        new Sortable(document.getElementById("structure-models"), {
            group: { name: 'structure', pull: 'clone', put: false },
        });
        // configure #element-models to allow drag with clone option
        new Sortable(document.getElementById("element-models"), {
            group: { name: 'component', pull: 'clone', put: false },
        });
        // configure #dataviz-items to allow drag
        new Sortable(document.getElementById("dataviz-items"), {
            group: { name: 'component', pull: 'clone', put: false },
        });
        // configure #report-composition to accept drag & drop from structure elements
        new Sortable(document.getElementById("report-composition"), {
            handle: '.drag',
            group: { name: 'structure' },
            onAdd: function (evt) { _initComponentContainer($(evt.item)); }
        });
    };

    /*
     * _onSelectReport. This method is linked to #selectedReportComposer -event change-
     * to update dataviz items linked to selected report
     */
    var _onSelectReport = function (e) {
        var reportId = $(this).val();
        
        // clear composition
        var $composition  = $("#report-composition").empty();
        var $dvzContainer = $("#dataviz-items").empty();
        
        // check report exists
        var reportData = admin.getReportData(reportId);
        $("#composer-report-title").text( reportData.title );
        if (! reportData) return _alert("Rapport sélectionné non disponible !", "danger", true);
        
        // add available dataviz items in menu list
        reportData.dataviz.forEach(function (dvz) {
            $dvzContainer.append(
                _composerTemplates.datavizTemplate
                .replace(/{{REF}}/g,      dvz.id)
                .replace(/{{LABEL}}/g,    dvz.title)
                .replace(/{{TYPE}}/g,     dvz.type)
                .replace(/{{ICON}}/g,     _getDatavizTypeIcon(dvz.type))
            );
        });
        
        // load the last report definition from database (async)
        saver.loadJsonReport(reportId, function(success, report_data) {
            if (! success) return;
            // sélection dans le composer du thème enregistré
            $("#selectedModelComposer").val( report_data.theme ).trigger('change');
            // application dans le composer des blocs chargés
            report_data.blocs.forEach((bloc) => {
                var $bloc = _makeReportBloc(bloc);
                if (! $bloc) return;
                $("#report-composition").append( $bloc );
                _initComposerTools( $bloc );
                _initComponentContainer( $bloc, true );
            });
        });
    };

// ============================================================================= Chargement d'un rapport existant

    /**
     * _makeReportBloc : traitement des blocs définis dans un rapport pour génération du DOM de composition
     */
    var _makeReportBloc = function (jsonBloc) {
        let ref = jsonBloc.ref || '-';
        
        // génération du HTML du bloc structurant en clonant l'élément disponible dans la sidebar
        let $structure = $('#structure-models .structure-bloc[data-bloc="' + ref + '"]').clone();
        if (! $structure.length) { console.warn("Bloc invalide: aucun bloc disponible correspondant (ignoré)", ref); return; }
        
        // nettoyage des conteneurs non-structurant de la composition
        $structure.find('.cols-tools, .cell-tools, .text-edit').remove();
        $structure.find('.layout-cell .component-container').remove();
        
        // intégration des données du JSON dans le DOM du composer
        if ('title'   in jsonBloc) _setTextData( jsonBloc.title,   $structure.find('.bloc-html .bloc-title')[0] );
        if ('sources' in jsonBloc) _setTextData( jsonBloc.sources, $structure.find('.bloc-html .bloc-sources')[0] );
        if ('layout'  in jsonBloc) _makeReportLayout( jsonBloc.layout, $structure.find('.bloc-html .bloc-layout') );
        
        // retourne la structure HTML du bloc à ajouter dans l'interface de composition
        console.debug("Bloc HTML généré du JSON :\n", $structure.html());
        return $structure;
    };

    /**
     * _makeReportLayout : génération et ajout du code HTML du layout (récursif) d'un bloc structurant
     */
    var _makeReportLayout = function (jsonLayout, $node) {
        // traitement d'un noeud "cell" avec sa liste de composants (dataviz|element)
        if (jsonLayout.type == 'cell') {
            let $cell = $( _composerTemplates.layout_cell.replace('{{SIZE}}', jsonLayout.size || 1) );
            if (jsonLayout.data) jsonLayout.data.forEach((data) => _makeReportComponent(data, $cell.find('.component-container')));
            if (jsonLayout.node) console.warn("Layout invalide: présence d'enfants dans un noeud terminal (ignorés)", jsonLayout.node);
            $node.replaceWith( $cell );
            return;
        }
        // traitement d'un noeud "data" avec sa liste de composants (dataviz|element)
        if (jsonLayout.type == 'data') {
            if (jsonLayout.data) jsonLayout.data.forEach((data) => _makeReportComponent(data, $node.find('.component-container')));
            if (jsonLayout.node) console.warn("Layout invalide: présence d'enfants dans un noeud terminal (ignorés)", jsonLayout.node);
            return;
        }
        // traitement d'un noeud "rows" ou "cols" avec sa liste d'enfants
        if (jsonLayout.type == 'rows' || jsonLayout.type == 'cols') {
            let childIdx = 0, $children = $node.children('.layout-rows, .layout-cols, .layout-cell, .layout-data');
            if (jsonLayout.node) jsonLayout.node.forEach((child) => {
                let $child = (childIdx < $children.length) ? $( $children[childIdx++] ) : $('<div>').appendTo( $node );
                // nettoyage des classes ('col-#', 'layout-#' et 'row')
                let nodeClass = $child.attr('class') || '';
                $child.attr('class', nodeClass.replace(_reSize, '$1$3').replace(_reType, '$1$3')).removeClass('col row');
                // génération du code HTML de l'enfant selon son type
                if ('type' in child) switch(child.type) {
                    case 'rows': _makeReportLayout(child, $child.addClass('layout-rows col-' + (child.size || 1))); break;
                    case 'cols': _makeReportLayout(child, $child.addClass('layout-cols row')); break;
                    case 'data': _makeReportLayout(child, $child.addClass('layout-data')); break;
                    case 'cell': _makeReportLayout(child, $child); break;
                    default: console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", child.type);
                }
            });
            return;
        }
        console.warn("Layout invalide: type de conteneur non reconnu (ignoré)", jsonLayout.type);
    };

    /**
     * _makeReportComponent : génération et ajout du code HTML d'un composant (dataviz|element) d'un rapport
     */
    var _makeReportComponent = function (jsonComponent, $node) {
        if (! $node.length) return console.warn("Aucun conteneur pour composants (dataviz|element)");
        console.log(jsonComponent);
        let $item;
        switch (jsonComponent.type) {
            case 'dataviz': $item = _makeDataviz(jsonComponent.ref, jsonComponent.opts); break;
            case 'element': $item = _makeElement(jsonComponent.ref, jsonComponent.opts); break;
        }
        if ($item) $node.append($item);
    };

    /*
     * _makeDataviz: used to generate composition HTML for a dataviz component
     */
    var _makeDataviz = function (ref, opts) {
        let dvzId = (opts.properties && opts.properties.id) ? opts.properties.id : ref;
        
        // génération du HTML de la dataviz en clonant l'élément disponible dans la sidebar
        let $item = $('#dataviz-items .dataviz-bloc[data-dataviz="'+ dvzId +'"]').clone();
        if (! $item.length) { console.warn("Dataviz invalide: aucune dataviz disponible correspondant (ignoré)", dvzId); return; }
        
        // si présence du type dans la définition, alors la dataviz a été configurée
        if ('type' in opts) {
            $item.find('code.dataviz-definition').text( JSON.stringify(opts) );
            $item.addClass('configured');
        }
        return $item;
    };

    /*
     * _makeElement: used to generate composition HTML for an element component
     */
    var _makeElement = function (ref, opts) {
        if (! ref) return;
        
        // génération du HTML du bloc composant en clonant l'élément disponible dans la sidebar
        let $item = $('#element-models .element-bloc[data-bloc="'+ ref +'"]').clone();
        if (! $item.length) { console.warn("Bloc invalide: aucun bloc disponible correspondant (ignoré)", ref); return; }
        
        // nettoyage des conteneurs non-structurant de la composition
//      $item.find('.text-edit').remove();
        
        // intégration des données du JSON dans le DOM du composer
        switch (ref) {
            case "btexte":
                if (opts) {
                    let $elem = $item.find('.bloc-html .bloc-element .bloc-content');
                    if (opts.style)   $elem.addClass("style-" + opts.style);
                    if (opts.content) $elem.html(opts.content);
                }
            break;
        }
        return $item;
    };

// ============================================================================= Modification d'un éditable (modal)

    var _textSelected = null;

    /*
     * _getTextData - retourne les données en cours d'un texte éditable (contenu text/html et classe de style)
     */
    var _getTextData = function (node) {
        if (! node.classList.contains('editable-text')) node = node.querySelector('.editable-text');
        let isHTML  = (node.querySelector(':scope > :not(button)') !== null);
        let style   = ""; for (let c of node.classList.values()) if (c.startsWith('style-')) style = c.slice(6);
        let content = "";
        if (isHTML) {
            content = node.innerHTML.replaceAll(/<button.*<\/button>/gi, '').replaceAll(/<!--.*-->/gi, '').trim();
        } else {
            let texts = [], child = node.firstChild;
            while (child) {
                if (child.nodeType == Node.TEXT_NODE) texts.push( child.data.trim() );
                child = child.nextSibling;
            }
            content = texts.filter(function(t){ return (t.length)>0 }).join("\n");
        }
        return { isHTML: isHTML, style: style, content: content }
    };

    /*
     * _setTextData - modification du contenu d'un texte éditable à partir des données JSON (load ou edit)
     */
    var _setTextData = function (data, node) {
        if (! node) return false;
        if (typeof data === "String") data = {'content': data, 'style': "", 'isHTML': false };
        for (let c of node.classList.values()) if (c.startsWith('style-')) node.classList.remove(c);
        if (data.style)  node.classList.add('style-' + data.style);
        if (data.isHTML) node.innerHTML = data.content;
        else             node.innerText = data.content;
        return true;
    };

    /*
     * _onTextEdit - method linked to #text-edit modal show event to configure modal
     */
    var _onTextEdit = function (evt) {
        let source = evt.relatedTarget.closest('.editable-text');
        if (! source) { console.warn("Aucun contexte source retrouvé pour l'édition d'un texte !"); return false; }

        let curText = _getTextData(source);
        if (source.classList.contains('bloc-title')) {
            evt.target.querySelector("#text-edit-level").disabled = false;
            evt.target.querySelector("input[value='text']").checked = true;
            evt.target.querySelector("input[value='html']").disabled = true;
        } else {
            evt.target.querySelector("#text-edit-level").disabled = true;
            evt.target.querySelector("input[value='html']").disabled = false;
            evt.target.querySelector("input[value='" + (curText.isHTML ? "html" : "text") +"']").checked = true;
        }
        evt.target.querySelector("#text-edit-level").value = curText.style;
        evt.target.querySelector("#text-edit-value").value = curText.content;

        _textSelected = source;
        return true;
    };

    /*
     * _textValidate - Application des modifications du texte dans le composer.
     */
    var _textValidate = function (evt) {
        var data = {}, input, modal = evt.target.closest('.modal');
        if (! modal) { console.warn("Impossible de retrouver le contexte du bouton !"); return false; }
        if (_textSelected) {
            if (input = modal.querySelector('#text-edit-level')) data.style = input.value;
            if (input = modal.querySelector('#text-edit-value')) data.content = input.value;
            if (input = modal.querySelector("[name='typeedit']:checked")) data.isHTML = (input.value === "html");
            if (_textSelected.classList.contains('bloc-title')) data.isHTML = false; // mode 'text' forcé pour les titres
            if (_setTextData(data, _textSelected)) {
                _initComposerTools( $(_textSelected) );
            } else console.warn("Échec lors de la modification du texte édité !");
        } else console.warn("Impossible de retrouver le texte en cours d'édition !");
        $(modal).modal('hide');
    };

// ============================================================================= Modification d'une grille de layout (modal)

    var _gridSelected = null;

    /*
     * _gridOpenForm - Ouverture de la modal Dimension avec initialisation du formulaire.
     */
    var _gridOpenForm = function (evt) {
        // groupes de lignes et de colonnes sélectionnées
        var colsDiv = evt.relatedTarget.closest('.layout-cols');
        var rowsDiv = evt.relatedTarget.closest('.layout-rows');
        _gridSelected = colsDiv;
        // comptage du nombre de lignes
        var rowsNum = 0;
        for (var i = 0; i < rowsDiv.childElementCount; i++) {
            if (rowsDiv.children[i].classList.contains('layout-cols')) rowsNum++;
        }
        // liste des colonnes (avec leurs largeurs bs)
        var colsList = [];
        for (var i = 0; i < colsDiv.childElementCount; i++) {
            var col = colsDiv.children[i];
            // prendre uniquement les enfants ayant la classe "layout-cell" ou "layout-rows"
            if (! _reTest.test(col.className)) continue;
            // récupération de la taille à partir de la classe "col-##"
            var result = _reSize.exec(col.className);
            colsList.push( (result !== null) ? result[2] : 1 );
        }
        // mise à jour du formulaire des dimensions
        var $colsForm = $(this).find('#grid-columns-size').empty();
        colsList.forEach(function(size) {
            $colsForm.append( _composerTemplates.grid_col_input.replace('{{VAL}}', size) );
        });
        if (! colsDiv.classList.contains('fixed-layout')) {
            $colsForm.append(_composerTemplates.grid_col_adder);
        }
    }

    /*
     * _gridAddNewCol - Ajout d'une cellule dans le formulaire (avec saisie de la largeur bs)
     */
    var _gridAddNewCol = function (evt) {
        var $btncol = $(this).closest('.col');
        var size = Math.max(1, 12 - _gridCheckCols($btncol.parent().find('input')));
        $btncol.before( _composerTemplates.grid_col_input.replace('{{VAL}}', size) );
        if ($btncol.siblings('.col').length >= 12) $btncol.remove();
    }

    /*
     * _gridCheckCols - Vérification des dimensions horizontales (total 12 pour grid bs)
     */
    var _gridCheckCols = function ($inputs) {
        var total = 0;
        $inputs.each( function(){
            let n = Number.parseInt($(this).val(), 10);
            n = isNaN(n) ? 1 : Math.max(1, Math.min(12, n));
            $(this).val(n);
            total+= n;
        });
        return total;
    }

    /*
     * _gridValidate - Enregistrement du formulaire des dimensions pour application dans le composer.
     */
    var _gridValidate = function (evt) {
        var colsDiv = _gridSelected;
        var $form = $(this).closest('.modal').find('form');
        var $inputs = $form.find('#grid-columns-size input');
        var inputIdx = 0, curCol;
        // vérification des dimensions horizontales (total 12 pour grid bs)
        if (_gridCheckCols($inputs) != 12) {
            alert("La somme des tailles des colonnes n'est pas égale à 12 !");
            return false;
        }
        // modification des colonnes existantes
        for (var i = 0; i < colsDiv.childElementCount; i++) {
            curCol = colsDiv.children[i];
            // prendre uniquement les enfants ayant la classe "layout-cell" ou "layout-rows"
            if (! _reTest.test(curCol.className)) continue;
            // modifier les classes de largeur "col-##" selon les inputs du formulaire
            curCol.className = curCol.className.replace(_reSize, '$1col-'+$inputs[inputIdx++].value+'$3');
        }
        // génération des nouvelles colonnes
        while (inputIdx < $inputs.length) {
            var $cell = _initComponentContainer(
                $( _composerTemplates.layout_cell.replace('{{SIZE}}', $inputs[inputIdx++].value) )
            );
            $cell.appendTo(colsDiv);
            _initComposerTools($cell);
        }
        // fermeture de la modal
        $(this).closest('.modal').modal('hide');
    }

// =============================================================================

    /*
     * Public
     */
    return {
        initComposer: _initComposer,

        /* used by admin.js */
        compose: function(reportId) {
            // show composer page
            $("#btn-composer").click();
            // set report select value
            $('#selectedReportComposer').val(reportId).trigger("change");
        },

        /* used by wizard.js */
        models: function() {
            return _HTMLTemplates;
        },

        /* used by wizard.js & textConfiguration.js */
        activeModel: function() {
            if (! _activeHTMLTemplate) return;
            if (! _activeHTMLTemplate in _HTMLTemplates) return;
            return _HTMLTemplates[_activeHTMLTemplate];
        },

        /* used by saver.js */
        getTextData: _getTextData,

        getDatavizTypeIcon: _getDatavizTypeIcon
    }; // fin return

})();

$(document).ready(function () {
    composer.initComposer();
    wizard.init();
//  textedit.init();
});

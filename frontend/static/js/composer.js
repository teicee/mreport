composer = (function () {
    /*
     * Private
     */

    var _debug = true;

    const _reTest = new RegExp('^(.* )?layout-(cell|rows)( .*)?$');
    const _reType = new RegExp('^(.* )?layout-([^ ]+)( .*)?$');
    const _reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');

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
     * _composerTemplates - {object}. This var store html templates to render composer structure and actions buttons.
     */
    var _composerTemplates = {
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
        text_tools: [
            '<button data-toggle="modal" data-target="#text-edit" class="btn btn-sm btn-warning text-edit">',
              '<i class="fas fa-edit"></i> <b>éditer</b>',
            '</button>'
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

    /*
     * _HTMLTemplates - {object} Store structured html blocks and parameters
     * issued from special HTML model for the composer ("model-composer.html")
     */
    var _HTMLTemplates = {}; // ModelData (from models.js)

    /*
     * _listModels - {object} List available models for the final front rendering.
     * TODO use config file (ask the backend?)
     */
    var _listModels = {
        "a":        "Modèle A",
        "b":        "Modèle B",
    };

    /*
     * _selectedModel - {string} Store the selected render model id
     */
    var _selectedModel = "";

    /*
     * _onSelectModel: Update style and icons store derived from selected render model
     * method linked to #selectedModelComposer change event
     * TODO
     */
    var _onSelectModel = function (e) {
        _selectedModel = this.value;
        /*
        // NOTE inutilisé pour ne charger les css du template que lorsque le wizard est ouvert
        // NOTE wizard peut ne pas encore être initialisé et fonctionnel !
        if (_selectedModel && wizard.ready()) {
            // update style in wizard modal
            wizard.updateStyle(_HTMLTemplates[_selectedModel]);
            // update icon store in wizard modal
            wizard.updateIconList(_HTMLTemplates[_selectedModel]);
        }
        */
    };

// ============================================================================= Initialisation du composer

    /*
     * _init - This method initializes composer by loading HTML templates.
     */
    var _init = function () {
        let $composerMain   = $('#composer .main');
        let $modelSelector  = $('#selectedModelComposer');
        let $reportSelector = $('#selectedReportComposer');
        
        // init render models selector
        if ($modelSelector) {
            $modelSelector.empty();
            $modelSelector.on('change', _onSelectModel);
            for (const modelId in _listModels) {
                $modelSelector.append('<option value="' + modelId + '">' + _listModels[modelId] + '</option>');
                // auto-select the first loaded model
                if (! _selectedModel) $modelSelector.val(modelId).trigger('change');
            }
            $modelSelector.prop("disabled", false);
        }
        
        // load the composer model
        models.load( 'composer', function(success, data){
            if (_debug) console.debug("Récupération des données du modèle de composition :\n", data);
            if (! success) return;
            _HTMLTemplates = data;
            
            // generate structures blocks in sidebar from composer template
            let $structures = $("#structure-models").remove('.list-group-item');
            for (const ref in _HTMLTemplates.structure_blocs) {
                $structures.append( _HTMLTemplates.makeStructureBloc(ref) );
            }
            _configureComposerTools($structures);
            _configureCustomColumns($structures);
            
            // generate elements blocks in sidebar from composer template
            let $elements = $("#element-models").remove('.list-group-item');
            for (const ref in _HTMLTemplates.element_blocs) {
                $elements.append( _HTMLTemplates.makeElementBloc(ref) );
            }
            _configureComposerTools($elements);
            
            // activation du sélecteur pour charger le rapport à composer
            $reportSelector.on('change', _onSelectReport);
            $reportSelector.prop("disabled", false);
        });
        
        // remove/empty actions
        $composerMain.on('click', '.bloc-tools .bloc-remove, .data-tools .bloc-remove', function(e){
            const $bloc = $(e.currentTarget).closest(".structure-item, .element-item, .dataviz-item");
            $bloc.remove();
        });
        $composerMain.on('click', '.cell-tools .cell-empty', function(e){
            const $data = $(e.currentTarget).closest(".layout-cell").find('.components-container');
            $data.empty();
        });
        $composerMain.on('click', '.cell-tools .cell-delete', function(e){
            const $cell = $(e.currentTarget).closest(".layout-cell");
            const $cols = $cell.closest(".layout-cols");
            const $rows = $cols.closest(".layout-rows");
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
        
        // cell division actions
        $composerMain.on('click', '.cell-tools .cell-divide', function(e){
            const $cell = $(e.currentTarget).closest(".layout-cell");
            if ($cell.siblings('.layout-cell, .layout-rows').length || $cell.closest('.layout-cols').hasClass('fixed-layout')) {
                // ajout d'un niveau de découpage à partir d'un layout-cell devenant un layout-rows (contenant 2 rows)
                // note: valable uniquement pour un layout-cell ayant déjà des frères (layout-cell ou layout-rows)
                $cell.removeClass("layout-cell").addClass("layout-rows");
                $cell.find(".cell-tools").remove();
                $cell.wrapInner('<div class="row layout-cols"><div class="col-12 layout-cell"></div></div>');
                $cell.append( _configureCellContainer($cell.find(".layout-cols").clone(), true) );
                _configureComposerTools($cell);
            } else {
                // sinon si le layout-cols parent ne contient que cet unique layout-cell (en col-12)...
                // - soit action divide disabled (utiliser action grid sur le layout-cols parent pour étendre rows ou cols)
                // - soit ajout d'une row (layout-cols) plutôt que split du layout-cell
                // - soit split vertical du layout-cell, càd ajout d'une col (layout-cell) => choix le plus attendu
                $cell.removeClass("col-12").addClass("col-6");
                $cell.after( _configureCellContainer($cell.clone(), true) );
            }
        });
        
        // configure modal to edit cells grid
        $('#composer_grid_form').on('show.bs.modal', _gridOpenForm);
        $('#grid-columns-size').on('click', '#grid-add-col', _gridAddNewCol);
        $('#grid-validate').on('click', _gridValidate);
        // configure modal to edit text
        $('#text-edit').on('show.bs.modal', _onTextEdit);
        $('#text-validate').on('click', _textValidate);
        
        // save report buttons (json)
        $("#save_report_json").on('click', function(e){
            const report_id = $reportSelector.val();
            if (report_id) saver.saveJsonReport(report_id, document.getElementById("report-composition"));
        });
        
        // configure #structure-models to allow drag with clone option
        new Sortable(document.getElementById("structure-models"), {
            group: { name: 'structure', pull: 'clone', put: false }, filter: 'input'
        });
        // configure #element-models to allow drag with clone option
        new Sortable(document.getElementById("element-models"), {
            group: { name: 'component', pull: 'clone', put: false },
        });
        // configure #dataviz-items to allow drag
        new Sortable(document.getElementById("dataviz-items"), {
            group: { name: 'component', pull: 'clone', put: false },
        });
    };

    /*
     * _configureComposerTools - Add composer action buttons to the edited structures
     * NOTE: à appliquer après l'insertion dans le composer (pour le check de profondeur)
     */
    var _configureComposerTools = function ($node) {
        // boutons d'action sur textes éditables
        $node.find(".editable-text").addBack(".editable-text").prepend(_composerTemplates.text_tools);
        // boutons d'action sur groupe de colonnes
        $node.find(".layout-cols").addBack(".layout-cols").prepend(_composerTemplates.cols_tools);
        // boutons d'action sur colonnes finales (cellules)
        $node.find(".layout-cell").addBack(".layout-cell").each(function(){
            $(this).prepend(_composerTemplates.cell_tools);
            // retrait du bouton de division si profondeur max atteinte (possible jusqu'à 4x4)
            if ($(this).parentsUntil('.bloc-layout', '.layout-cols').length > 2) $(this).find('.cell-divide').remove();
        });
        return $node;
    };

    /*
     * _configureCustomColumns - Add events for the custom structure block (columns sizes input)
     */
    var _configureCustomColumns = function ($structures) {
        let $bcustom = $structures.find('input.bcustom');
        if (! $bcustom.length) return;
        
        $bcustom.on('change', function(evt){
            let sum = 0; oks = [];
            this.value.replaceAll(/[^0-9]/g, ' ').replace(/ +/, ' ').trim().split(' ').forEach((col) => {
                col = Math.min(Math.max(col, 1), 12);
                if (sum < 12) { oks.push(Math.min(col, 12 - sum)); sum+= col; }
            });
            this.value = oks.join(' ');
            let $cols = $(this).closest('.structure-item').find('.structure-html .bloc-structure .layout-cols');
            if ($cols.length) _gridResizer($cols[0], oks);
        });
        
        $bcustom.on('keypress', function(evt){
            let ASCIICode = (evt.which) ? evt.which : evt.keyCode;
            if (ASCIICode <= 32) return true; // controles & espace
            return (ASCIICode < 48 || ASCIICode > 57) ? false : true;
        });
        
        $bcustom.on('pointerdown', function(evt){ evt.stopPropagation(); return true; });
    };

    /*
     * _configureCellContainer - Configure container to be able to receive list of dataviz|element components.
     */
    var _configureCellContainer = function ($node, do_empty = false) {
        $node.find(".layout-cell, .layout-data").addBack(".layout-cell, .layout-data").each(function(){
            // ajout du conteneur de composants (element|dataviz) s'il n'existe pas déjà
            let container = this.querySelector(".components-container");
            if (! container) {
                this.insertAdjacentHTML("beforeend", _HTMLTemplates.page_layouts['wcell'] );
                container = this.querySelector(".components-container");
                if (! container) return $el;
            }
            // suppression des composants déjà présents dans le conteneur (utile après un clone de division)
            if (do_empty) while (container.firstChild) { container.removeChild( container.lastChild ); }
            // drop component behaviors (dataviz or element)
            new Sortable( container, {
                group: 'component',
                filter: '.btn:not(.drag)',
                onAdd: function (evt) {
                    let $item = $(evt.item);
                    // mise en place d'un component dataviz
                    if ($item.hasClass("dataviz-item")) {
                        // Test if title component
                        if ($item.closest(".dataviz-autoconfig").length) {
                            // No wizard needed. autoconfig this dataviz & deactivate wizard for this dataviz
                            var dataviz = $item.closest(".dataviz-item").attr("data-dataviz");
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
            for (const dvz of this.getElementsByClassName("dataviz-item")) wizard.getSampleData(dvz.dataset['dataviz']);
            if ($(this).closest(".dataviz-autoconfig").length) $(this).find(".data-tools .btn.edit").hide();
        });
        return $node;
    };

    /*
     * _renderDataviz - Display dataviz component for the composer
     */
    var _renderDataviz = function ($node) {
        $node.find('.components-container .dataviz-proxy').each( function(){
            let ref = this.getAttribute('data-ref');
            let $dataviz = $('#dataviz-items .dataviz-item[data-dataviz="'+ ref +'"]').clone();
            if (! $dataviz.length) return console.warn("Dataviz invalide: aucune dataviz disponible correspondant ("+ ref +")");
            
            let opt = JSON.parse(this.innerText);
            $dataviz.find('code.dataviz-definition').text( this.innerText );
            if (opt.type) $dataviz.addClass('configured');
            
            this.replaceWith( $dataviz[0] );
        });
        return $node;
    };

    /*
     * _onSelectReport - This method is linked to #selectedReportComposer -event change-
     * to update dataviz items linked to selected report and load the report composition
     */
    var _onSelectReport = function (e) {
        let reportId = $(this).val();
        if (! reportId) return;
        
        // clear composition
        let $dvzsContainer = $("#dataviz-items").empty();
        let $rootContainer = $("#composer .main").empty();
        
        // check report exists
        var reportData = admin.getReportData(reportId);
        if (_debug) console.debug("Configuration du rapport (avec liste des dataviz disponibles) :\n", reportData);
        if (! reportData) return _alert("Rapport sélectionné non disponible !", "danger", true);
        
        // add available dataviz items in menu list
        reportData.dataviz.forEach((dvz) => {
            $dvzsContainer.append(
                _HTMLTemplates.page_layouts['wdataviz']
                .replace(/{{REF}}/g,      dvz.id)
                .replace(/{{LABEL}}/g,    dvz.title)
                .replace(/{{TYPE}}/g,     dvz.type)
                .replace(/{{ICON}}/g,     _getDatavizTypeIcon(dvz.type))
            );
        });
        
        // load the last report definition from database (async)
        saver.loadJsonReport(reportId, function(success, reportJson) {
            if (! success) return;
            // initialisation des éléments du composer dans la page
            let composition = $rootContainer.append( _HTMLTemplates.page_layouts['wmain'] ).find('#report-composition')[0];
            if (! composition) return Swal.fire("Problème", "L'interface du composeur n'est pas valide", 'error');
            $("#composer-report-title").text( reportData.title );
            if (reportJson.model) $("#selectedModelComposer").val( reportJson.model ).trigger('change');
            // application dans le composer des blocs chargés
            reportJson.blocs.forEach((bloc) => {
                let $bloc = _HTMLTemplates.buildReportBloc(bloc);
                if ($bloc) {
                    _renderDataviz( $bloc );
                    _configureComposerTools( $bloc );
                    _configureCellContainer( $bloc );
                    $bloc.appendTo(composition);
                }
            });
            // configure #report-composition to accept drag & drop from structure elements
            new Sortable(composition, {
                group: { name: 'structure' },
                handle: '.drag',
                onAdd: function (evt) {
                    if (evt.item.classList.contains('structure-item')) {
                        _configureCellContainer( $(evt.item) );
                    }
                }
            });
        });
    };

// ============================================================================= Modification d'un éditable (modal)

    var _textSelected = null;

    /*
     * _getTextData - retourne les données en cours d'un texte éditable (contenu text/html et classe de style)
     */
    var _getTextData = function (node) {
        if (! node.classList.contains('editable-text')) node = node.querySelector('.editable-text');
        let isHTML  = (node.querySelector(':scope > :not(button)') !== null);
        let style   = ""; for (const c of node.classList.values()) if (c.startsWith('style-')) style = c.slice(6);
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
        for (const c of node.classList.values()) if (c.startsWith('style-')) node.classList.remove(c);
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
//          evt.target.querySelector("#text-edit-level").disabled = false;
            evt.target.querySelector("input[value='text']").checked = true;
            evt.target.querySelector("input[value='html']").disabled = true;
        } else {
//          evt.target.querySelector("#text-edit-level").disabled = true;
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
            if (_setTextData(data, _textSelected)) _configureComposerTools( $(_textSelected) );
            else console.warn("Échec lors de la modification du texte édité !");
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
        for (let i = 0; i < rowsDiv.childElementCount; i++) {
            if (rowsDiv.children[i].classList.contains('layout-cols')) rowsNum++;
        }
        // liste des colonnes (avec leurs largeurs bs)
        var colsList = [];
        for (let i = 0; i < colsDiv.childElementCount; i++) {
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
            let n = Number.parseInt(this.value, 10);
            n = isNaN(n) ? 1 : Math.max(1, Math.min(12, n));
            this.value = n;
            total+= n;
        });
        return total;
    }

    /*
     * _gridValidate - Enregistrement du formulaire des dimensions pour application dans le composer.
     */
    var _gridValidate = function (evt) {
        let $modal = $(this).closest('.modal');
        let $inputs = $modal.find('form #grid-columns-size input');
        // vérification des dimensions horizontales (total 12 pour grid bs)
        if (_gridCheckCols($inputs) != 12) {
            alert("La somme des tailles des colonnes n'est pas égale à 12 !");
            return false;
        }
        _gridResizer(_gridSelected, $inputs.map(function(){ return this.value; }).get(), true);
        // fermeture de la modal
        $modal.modal('hide');
    }

    /*
     * _gridResizer - Création/modification/suppression des colonnes d'un conteneur.
     */
    var _gridResizer = function (node, sizes, doCellConfig = false) {
        let idx = 0;
        // suppression des colonnes en trop
        while (node.childElementCount > sizes.length) node.lastElementChild.remove();
        // modification des colonnes existantes
        for (let i = 0; i < node.childElementCount; i++) {
            let curCol = node.children[i];
            // prendre uniquement les enfants ayant la classe "layout-cell" ou "layout-rows"
            if (! _reTest.test(curCol.className)) continue;
            // modifier les classes de largeur "col-##" selon les inputs du formulaire
            curCol.className = curCol.className.replace(_reSize, '$1col-'+ sizes[idx++] +'$3');
        }
        // génération des nouvelles colonnes
        while (idx < sizes.length) {
            let $cell = $("<div>").addClass("layout-cell col-" + sizes[idx++]);
            _configureComposerTools($cell);
            if (doCellConfig) _configureCellContainer($cell);
            $cell.appendTo(node);
        }
    }

// =============================================================================

    /*
     * Public
     */
    return {
        /* used by composer.js */
        init:           _init,
        /* used by admin.js */
        compose:        function(reportId) {
            $("#btn-composer").click(); // show composer page
            $('#selectedReportComposer').val(reportId).trigger("change"); // set report select value
        },
        /* used by saver.js */
        getTextData:    _getTextData,
        /* used by saver.js & wizard.js */
        getModelId:     function() { return _selectedModel; },
        /* used by wizard.js & textConfiguration.js */
        getTemplates:   function() { return _HTMLTemplates; },
    };

})();

$(document).ready(function () {
    composer.init();
    wizard.init();
//  textedit.init();
});

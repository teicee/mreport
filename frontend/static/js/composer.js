composer = (function () {
    /*
     * Private
     */

    /*
     * _composerTemplates - {object}. This var store html templates to render composer structure and actions buttons.
     */
    var _composerTemplates = {
        // HTML used to construct bloc elements and append it to dom with selected HTMLTemplate
        blockTemplate: [
            '<li class="structure-bloc list-group-item handle" data-bloc="{{REF}}">',
              '<div class="bloc-tools btn-group btn-group-sm">',
                '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-danger bloc-remove"><i class="fas fa-times"></i> <b>supprimer</b></button>',
              '</div>',
              '<span class="structure-description"><i class="fas fa-arrows-alt"></i> {{LABEL}}</span>',
              '<div class="structure-html">{{HTML}}</div>',
            '</li>'
        ].join(""),
        // HTML used to construct extra elements and append it to dom with selected HTMLTemplate
        extraElementTemplate: [
            '<li class="structure-element list-group-item handle" data-bloc="{{REF}}">',
              '<div class="bloc-tools btn-group btn-group-sm">',
                '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-danger bloc-remove"><i class="fas fa-times"></i> <b>supprimer</b></button>',
              '</div>',
              '<span class="structure-description"><i class="fas fa-arrows-alt"></i> {{TEXT}}</span>',
              '<div class="structure-html"><span class="editable-text {{CLASS}}">{{TEXT}}</span></div>',
            '</li>'
        ].join(""),
        // HTML used to construct dataviz items and append them to dom in #dataviz-items list
        datavizTemplate: [
            '<li data-dataviz="{{id}}" title="{{dvz}}" data-report="{{reportId}}" class="dataviz list-group-item handle">',
              '<div class="data-tools btn-group-sm">',
                '<button class="btn btn-light drag"><i class="fas fa-arrows-alt"></i> <b>déplacer</b></button>',
                '<button class="btn btn-warning edit" data-toggle="modal" data-component="report" data-related-id="{{id}}" data-target="#wizard-panel"><i class="fas fa-cogs"></i> <b>éditer</b></button>',
              '</div>',
              '<span class="dataviz-description"><i class="dvz-icon {{icon}}"></i> {{dvz}}</span>',
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
              '<ul class="dataviz-container list-group"></ul>',
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
    var _parseTemplate = function (templateid, html) {
        // get data- linked to the template
        var parameters = $(html).data(); /* eg data-colors... */
        if (parameters.colors) parameters.colors = parameters.colors.split(",");
        
        //get style
        var page_style = $(html).find("style")[0];
        if (page_style) page_style = page_style.outerHTML;
        
        //get main template div
        var page_layout = $(html).find("template.report").get(0).content.firstElementChild.outerHTML;
        
        //get all report-bloc and report-bloc-title
        var structure_elements = {};
        $(html).find("template.report-bloc, template.report-bloc-title").each(function (id, template) {
            structure_elements[ template.id ] = $(template).prop('content').firstElementChild;
        });
        //Retrieve all dataviz components
        var dataviz_components = {};
        ["figure", "chart", "table", "title", "text", "iframe", "image", "map"].forEach(function (component) {
            var element = $(html).find("template.report-component.report-" + component).prop('content').firstElementChild;
            dataviz_components[component] = $.trim(element.outerHTML);
        });
        //Populate _HTMLTemplates with object
        _HTMLTemplates[templateid] = {
            id:                 templateid,
            parameters:         parameters,
            style:              page_style,
            page:               page_layout,
            structure_elements: structure_elements,
            dataviz_components: dataviz_components
        };
    };

    /*
     * _addComposerElements - Add composer action buttons to the edited structures
     * NOTE: à appliquer après l'insertion dans le composer (pour le check de profondeur)
     */
    var _addComposerElements = function ($el) {
        $el.find(".layout-cols").addBack(".layout-cols").prepend(_composerTemplates.cols_tools);

//      $el.find(".layout-cell").addBack(".layout-cell").prepend(_composerTemplates.cell_tools);
        $el.find(".layout-cell").addBack(".layout-cell").each(function(){
            $(this).prepend(_composerTemplates.cell_tools);
            // retrait du bouton de division si profondeur max atteinte (possible jusqu'à 4x4)
            if ($(this).parentsUntil('.bloc-content', '.layout-cols').length > 2) $(this).find('.cell-divide').remove();
        });

        $el.find(".editable-text").addBack(".editable-text").prepend(_composerTemplates.editable_element);

        return $el;
    };

    /*
     * _initComposerBlocks - Update structure elements choice in composer page
     */
    var _initComposerBlocks = function () {
        const $structures = $("#structure-models").remove('.list-group-item');
        const $elements = $("#element-models").remove('.list-group-item');
        
        // generate structures blocks from composer template
        for (var ref in _HTMLTemplates['composer'].structure_elements) {
            const elem = _HTMLTemplates['composer'].structure_elements[ref];
            $structures.append(
                _composerTemplates.blockTemplate
                .replaceAll("{{LABEL}}", elem.getAttribute("data-label"))
                .replaceAll("{{HTML}}", elem.outerHTML)
                .replaceAll("{{REF}}", ref)
            );
        };
        _addComposerElements($structures);
        
        // generate elements blocks from composer template
        ["Texte"].forEach(function (elem) {
            $elements.append(
                _composerTemplates.extraElementTemplate
                .replaceAll("{{CLASS}}", "")
                .replaceAll("{{TEXT}}", elem)
                .replaceAll("{{REF}}", "extra-" + elem.toLowerCase())
            );
        });
        _addComposerElements($elements);
    };

    /*
     * _initDatavizContainer - Configure container to be able to receive and configure dataviz.
     */
    var _initDatavizContainer = function ($el, noempty) {
        $el.find(".dataviz-container").each(function(i) {
            if (! noempty) $(this).empty();
            new Sortable(this, {
                group: 'dataviz',
                animation: 150,
                onAdd: function (evt) {
                    $(evt.item).addClass("mreport-primary-color-3-bg");
                    // Test if title component
                    var test_title = $(evt.item).closest(".dataviz-container").parent().hasClass("report-bloc-title");
                    if (test_title) {
                        // No wizard needed. autoconfig this dataviz & deactivate wizard for this dataviz
                        var dataviz = $(evt.item).closest(".dataviz").attr("data-dataviz");
                        // Inject dataviz definition directy
                        $(evt.item).find("code.dataviz-definition").text(
                            _HTMLTemplates['composer'].dataviz_components['title'].replace("{{dataviz}}", dataviz)
                        );
                        // Set title icon & deactivate wizard button
                        $(evt.item).find(".dataviz-description .dvz-icon").attr("class", "dvz-icon fas fa-heading");
//                      $(evt.item).find(".data-tools .btn.edit").prop('disabled', true);
                    } else {
//                      $(evt.item).find(".data-tools .btn.edit").prop('disabled', false);
                    }
                }
            });
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
            $.ajax({
                url: "/static/html/model-" + templateId + ".html",
                dataType: "text",
                success: function (html) {
                    _parseTemplate(templateId, html);
                    // if composer template: generate structures blocks list
                    if (templateId == 'composer') return _initComposerBlocks();
                    // else add the choice to the selector (and select it if none selected yet)
                    $("#selectedModelComposer").append('<option value="' + templateId + '">' + _listTemplates[templateId] + '</option>');
                    if (! $("#selectedModelComposer").val()) $("#selectedModelComposer").val(templateId).trigger('change');
                },
                error: function (xhr, status, err) {
                    _alert("Erreur avec le fichier html/model-" + templateId + ".html " + err, "danger", true);
                }
            });
        };

        // save report button action
        $("#btn_save_report").on('click', _saveReport);
        // configure modal to edit text
        $('#text-edit').on('show.bs.modal', _onTextEdit);

        // remove/empty actions
        $('#report-composition').on('click', '.bloc-tools .bloc-remove', function(e){
            const $bloc = $(e.currentTarget).closest(".structure-bloc");
//          $bloc.find(".dataviz").appendTo("#dataviz-items");
            $bloc.remove();
        });
        $('#report-composition').on('click', '.cell-tools .cell-empty', function(e){
            const $data = $(e.currentTarget).closest(".layout-cell").find('.dataviz-container');
//          $data.find(".dataviz").appendTo("#dataviz-items");
            $data.empty();
        });
        $('#report-composition').on('click', '.cell-tools .cell-delete', function(e){
            const $cell = $(e.currentTarget).closest(".layout-cell");
            const $cols = $cell.closest(".layout-cols");
            const $rows = $cols.closest(".layout-rows");
//          $cell.find(".dataviz").appendTo("#dataviz-items");
            $cell.remove();
            
            // ajustements sur le layout-cols selon son nombre d'enfants (layout-cell ou layout-rows)
            var $others = $cols.children('.layout-cell, .layout-rows');
            if ($others.length == 0) $cols.remove();
            else if ($others.length == 1) {
                // remplacer la classe de largeur "col-##" en "col-12"
                const reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');
                $others.attr('class',$others.attr('class').replace(reSize, '$1col-12$3'));
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
                $cell.append(_initDatavizContainer($cell.find(".layout-cols").clone()));
                _addComposerElements($cell);
            } else {
                $cell.removeClass("col-12").addClass("col-6");
                $cell.after(_initDatavizContainer($cell.clone()));
            }
        });

        // configure modal to divide cells
        $('#composer_grid_form').on('show.bs.modal', _gridOpenForm);
        $('#grid-columns-size').on('click', '#grid-add-col', _gridAddNewCol);
        $('#grid-validate').on('click', _gridValidate);

        // configure #structure-models to allow drag with clone option
        new Sortable(document.getElementById("structure-models"), {
            group: { name: 'structure', pull: 'clone', put: false },
        });
        // configure #element-models to allow drag with clone option
        new Sortable(document.getElementById("element-models"), {
            group: { name: 'structure', pull: 'clone', put: false },
        });
        // configure #dataviz-items to allow drag
        new Sortable(document.getElementById("dataviz-items"), {
            group: { name: 'dataviz', pull: 'clone', put: false },
        });
    };

    /*
     * _onSelectReport. This method is linked to #selectedReportComposer -event change-
     * to update dataviz items linked to selected report
     */
    var _onSelectReport = function (e) {
        var reportId = $(this).val();

        // clear composition
        $("#report-composition").empty();
        // get and show report title
        $("#composer-report-title").text( admin.getReportData(reportId).title );

        // Update dataviz items in menu list
        var $dvzContainer = $("#dataviz-items").empty();
        admin.getReportData(reportId).dataviz.forEach(function (dvz) {
            $dvzContainer.append(
                _composerTemplates.datavizTemplate
                .replace(/{{dvz}}/g,      dvz.title)
                .replace(/{{id}}/g,       dvz.id)
                .replace(/{{reportId}}/g, reportId)
                .replace(/{{type}}/g,     dvz.type)
                .replace(/{{icon}}/g,     _getDatavizTypeIcon(dvz.type))
            );
        });

        // Request last report backup data
        $.ajax({
            type: "GET",
            url: [report.getAppConfiguration().api, "backup", reportId, "last"].join("/"),
            dataType: "json",
            error: function (xhr, status, error) {
                console.error("erreur : " + error);
            },
            success: function (data) {
                // Load template from JSON
                console.log(data);
//              saver.loadJsonReport(reportId, data.report_backups);
                /*
                    let alldvz = reportCompo.getElementsByClassName("dataviz");
                    for (elem of alldvz) {
                        wizard.getSampleData(elem.dataset.dataviz);
                    }
                    _configureNewBlock(reportCompo.querySelectorAll(".row"));
                    $("#report-composition .structure-bloc").find(".bloc-remove").click(function (e) {
                        $(e.currentTarget).closest(".structure-bloc").find(".dataviz").appendTo("#dataviz-items");
                        $(e.currentTarget).closest(".structure-bloc").remove();
                    });
                    $("#report-composition .structure-element").find(".bloc-remove").click(function (e) {
                        e.currentTarget.parentNode.remove();
                    });
                */
                
                // configure #report-composition to accept drag & drop from structure elements
                new Sortable(document.getElementById("report-composition"), {
                    handle: '.drag',
                    group: 'structure',
                    animation: 150,
                    onAdd: function (evt) { _initDatavizContainer($(evt.item)); }
                });

            }
        });
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
     * _onTextEdit. method linked to #text-edit modal show event to configure modal
     * TODO
     */
    var _onTextEdit = function (a) {
        var source;
        var content;
        var oldtext;
        var oldtype;
        var cas = 0;


        if (a.relatedTarget.parentNode.classList.contains("bloc-title")) {
            //Cad 1 Titles
            cas = 1;
            source = a.relatedTarget.parentNode;
            if (source.firstChild.nodeType === Node.TEXT_NODE) {
                content = source.firstChild;
            } else if  (source.firstChild.nodeType === Node.COMMENT_NODE) {
                source.firstChild.remove();
                if (source.firstChild.nodeType !== Node.TEXT_NODE) {
                    var txt = document.createTextNode("Title");
                    source.insertBefore(txt,source.firstElementChild);
                }

            }
            content = source.firstChild;
            try {
                oldtext = content.nodeValue.trim();
            } catch (error) {
                console.log(error);
            }
            oldtype = "text";
            //content = source.querySelector("p.text-htm");
            //Désactivation html
            document.querySelector("#text-edit input[value='html']").disabled = true;
            document.querySelector("#text-edit input[value='text']").checked = true;

        } else if (a.relatedTarget.parentNode.closest(".text-edit-content")) {
            //Cas 2 sources nouveau template
            cas = 2;
            document.querySelector("#text-edit input[value='html']").disabled = false;
            source = a.relatedTarget.parentNode.closest(".text-edit-content");
            content = source.querySelector("p.text-htm");
            if (content.classList.contains("html")) {
                //HTMLcontent
                oldtext = content.innerHTML;
                oldtype = "html";

            } else if (content.classList.contains("text")) {
                //TEXT CONTENT
                oldtext = content.firstChild.nodeValue.trim();
                oldtype = "text";
            }
        } else {
            //cas3 sources ancien template
            cas = 3;
            source = a.relatedTarget.parentNode;
            document.querySelector("#text-edit input[value='html']").disabled = false;
            oldtext = source.parentElement.textContent.trim().split("\n")[0];
            oldtype = "text";
        }

        document.querySelector("#text-edit input[value='"+oldtype+"']").checked = true
        $("#text-edit-value").val(oldtext);

        var getStyle = function () {
            let style = "undefined";
            source.classList.forEach(function (cls) {
                if (cls.indexOf("titre-")>=0) {
                    style = cls;
                }
            })
            return style;
        }

        //store old style
        var oldstyle = getStyle();

        var setStyle = function (style) {
            if (style !== oldstyle) {
                source.classList.remove(oldstyle);
                if (style && style !== 'undefined') {
                    source.classList.add(style);
                }
            }

        }
        //Get selected text element

        //get style value or Set default style
        $("#text-edit-level").val(getStyle());
        //Get save button and remove existing handlers
        var btn = $(a.currentTarget).find(".text-save").off("click");
        //Add new handler to save button
        $(btn).click(function (e) {
            //get new text value and store it in composition
            var text = $("#text-edit-value").val();
            //Get style
            var newstyle = $("#text-edit-level").val();
            //get type content (text or html)
            var type = $('#text-edit input[name=typeedit]:checked').val();
            if (type === "text") {
                if (cas === 2)  {
                    content.classList.remove("html");
                    content.classList.add("text");
                    content.innerHTML = "";
                    var txt = document.createTextNode(text.trim());
                    content.appendChild(txt);
                } else if (cas === 1){
                    content.nodeValue = text.trim();
                } else {
                    //cas 3
                    //destroy old structure
                    source.parentElement.innerHTML = `
                        <div class="text-edit-content">
                            <p class="text-htm text">${text.trim()}</p>
                            <i class="editable-text">
                            <span data-toggle="modal" data-target="#text-edit" class="to-remove text-edit badge badge-warning"><i class="fas fa-edit"></i>edit                        </span>
                            </i>
                        </div>`
                }


                setStyle(newstyle);
            } else if (type === "html") {
                if (cas === 2)  {
                    content.classList.remove("text");
                    content.classList.add("html");
                    content.innerHTML = text;

                } else if (cas === 3) {
                    //destroy old structure
                    if (source.parentElement.closest("div")) {
                        source.parentElement.closest("div").innerHTML = `
                        <div class="text-edit-content">
                            <p class="text-htm html">${text.trim()}</p>
                            <i class="editable-text">
                            <span data-toggle="modal" data-target="#text-edit" class="to-remove text-edit badge badge-warning"><i class="fas fa-edit"></i>edit                        </span>
                            </i>
                        </div>`
                    content = source.querySelector("p");
                    } else {
                        console.log ("cas non géré")
                        return;
                    }

                }

            }
            //close modal
            $("#text-edit").modal("hide");
        });


    };


    /*
     * __exportHTML. This method is used to convert composer composition
     * into valid html ready to use in mreport.
     * Method is used by _saveReport method.
     */

    var _exportHTML = function () {
        if (!_HTMLTemplates[_activeHTMLTemplate]) {
            alert("Veuillez sélectionner un template");
            return;
        }
        var html = [];
        // Get first title
        $("#report-composition .report-bloc-title").each(function (id, title) {
            if (id === 0) {
                var dvz = $(title).find("code.dataviz-definition");
                dvz.addClass("full-width");
                html.push(dvz.text());
            }
        });
        //get blocs with their dataviz configuration
        $("#report-composition .report-bloc,#report-composition .structure-element").each(function (id, bloc) {
            var tmp_bloc = $(bloc).clone();
            //delete extra row attributes
            ["data-model-title", "data-model-description"].forEach(function (attr) {
                $(tmp_bloc).removeAttr(attr);
            });
            //delete extra controls
            $(tmp_bloc).find(".to-remove").remove();
            $(tmp_bloc).find(".cell-tools").remove();
            if (tmp_bloc.hasClass("structure-element")) {
                $(tmp_bloc).find(".badge").remove();
                tmp_bloc.removeClass("list-group-item");
                let style = textedit.getTextStyle(tmp_bloc[0]);
                tmp_bloc[0] = textedit.applyTextStyle(tmp_bloc[0], style);
            } else {
                // loop on dataviz-container
                $(tmp_bloc).find(".dataviz-container").each(function (id, container) {
                    var pre_content = [];
                    var main_content = [];
                    var post_content = [];
                    //loop on elements and dataviz
                    $(container).find(".list-group-item").each(function (idx, item) {
                        var main_position = 0;
                        if ($(item).hasClass("dataviz")) {
                            var dvz = $(item).find("code.dataviz-definition").text();
                            main_content.push(dvz);
                            main_position = idx;
                        } else if ($(item).hasClass("structure-element")) {
                            var txt = $(item).find(".structure-element-html").html();
                            if (idx == 0) {
                                main_content.push(txt);
                            } else if (idx > main_position) {
                                post_content.push(txt);
                            } else {
                                pre_content.push(txt);
                            }

                        }
                    });
                    var tmp = $.parseHTML(main_content.join(""));

                    $(tmp).prepend(pre_content.join(""));
                    $(tmp).append(post_content.join(""));
                    $(container).html(tmp);

                });
            }
            html.push($(tmp_bloc).get(0).outerHTML);
        });

        //generate html definition from template and composer elements
        var _page = $.parseHTML(_HTMLTemplates[_activeHTMLTemplate].page);
        var _export = $(_page).find(".report").append(html.join("\n")).parent().get(0).outerHTML;

        return _export;
    };

    /*
     * _saveTeport.  This method is used by #btn_save_report to
     * save active composition into dedicated report.html
     */

    var _saveReport = function () {
        var _report = $("#selectedReportComposer").val();

        // Save JSON report
        const report_data = saver.exportJson(document.getElementById("report-composition"));
        console.log(JSON.stringify(report_data));

        saver.saveJsonReport(_report, report_data);

        // Save HTML report
        /*
        var html_options = {tabString: '  '};
        var newDom = indent.html(_exportHTML(), html_options);
        var _css = ['<style>',
            composer.activeModel().style.match(/(?<=\<style\>)(.|\n)*?(?=\<\/style\>)/g)[0].trim(),
            composer.activeModel().iconstyle,
            '</style>']. join(" ");
        var composerHTML = document.getElementById("report-composition").innerHTML;
        composerHTML = indent.html(composerHTML, html_options);
        //get String beetwenn <style>...</style>
        var css = _css.substring(_css.lastIndexOf("<style>") + 7, _css.lastIndexOf("</style")).trim();
        $.ajax({
            type: "POST",
            url: [report.getAppConfiguration().api, "report_html", _report].join("/"),
            data: JSON.stringify({
                html: newDom,
                css: css,
                composer: composerHTML
            }),
            dataType: 'json',
            contentType: 'application/json',
            success: function (response) {
                if (response.response === "success") {
                    Swal.fire({
                        title: 'Sauvegardé',
                        text: "Le rapport \'" + _report + "\' a été sauvegardé",
                        icon: 'success',
                        showCancelButton: true,
                        cancelButtonText: 'Ok',
                        confirmButtonColor: '#3085d6',
                        cancelButtonColor: '#32CD32',
                        confirmButtonText: 'Afficher'
                    }).then((result) => {
                        if (result.value) {
                            window.open("/mreport/" + _report, "_blank");
                        }
                    });
                } else {
                    alert("enregistrement échec :" + response.response)
                }

            },
            error: function (a, b, c) {
                console.log(a, b, c);
            }
        });
        */
    };




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
        for (var i = 0; i < rowsDiv.childElementCount; i++)
            if (rowsDiv.children[i].classList.contains('layout-cols')) rowsNum++;

        // liste des colonnes (avec leurs largeurs bs)
        var colsList = [];
        for (var i = 0; i < colsDiv.childElementCount; i++) {
            var col = colsDiv.children[i];
            // prendre uniquement les enfants ayant la classe "layout-cell" ou "layout-rows"
            const reTest = new RegExp('^(.* )?layout-(cell|rows)( .*)?$');
            if (! reTest.test(col.className)) continue;
            // récupération de la taille à partir de la classe "col-##"
            const reSize = new RegExp('^(.* )?col-([0-9]+)');
            var result = reSize.exec(col.className);
            colsList.push( (result !== null) ? result[2] : 1 );
        }

        // mise à jour du formulaire des dimensions
        var $colsForm = $(this).find('#grid-columns-size').empty();
        colsList.forEach(function(size) {
            $colsForm.append( _composerTemplates.grid_col_input.replace('{{VAL}}', size) );
        });
        if (! colsDiv.classList.contains('layout-fixed')) {
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

        // vérification des dimensions horizontales (total 12 pour grid bs)
        if (_gridCheckCols($inputs) != 12) {
            alert("La somme des tailles des colonnes n'est pas égale à 12 !");
            return false;
        }

        const reTest = new RegExp('^(.* )?layout-(cell|rows)( .*)?$');
        const reSize = new RegExp('^(.* )?col-([0-9]+)( .*)?$');
        var inputIdx = 0;
        var curCol;
        // modification des colonnes existantes
        for (var i = 0; i < colsDiv.childElementCount; i++) {
            curCol = colsDiv.children[i];
            // prendre uniquement les enfants ayant la classe "layout-cell" ou "layout-rows"
            if (! reTest.test(curCol.className)) continue;
            // modifier les classes de largeur "col-##" selon les inputs du formulaire
            curCol.className = curCol.className.replace(reSize, '$1col-'+$inputs[inputIdx++].value+'$3');
        }
        // génération des nouvelles colonnes
        while (inputIdx < $inputs.length) {
            var $cell = _initDatavizContainer(
                $( _composerTemplates.layout_cell.replace('{{SIZE}}', $inputs[inputIdx++].value) )
            );
            $cell.appendTo(colsDiv);
            _addComposerElements($cell);
        }

        $(this).closest('.modal').modal('hide');
    }


    return {
        initComposer: _initComposer,

        /* used by admin.js */
        compose: function(reportId) {
            // show composer page
            $("#btn-composer").click();
            // set report select value
            $('#selectedReportComposer option[value="' + reportId + '"]').prop('selected', true).trigger("change");
        },

        /* used by wizard.js */
        models: function() {
            return _HTMLTemplates;
        },

        /* used by wizard.js & textConfiguration.js */
        activeModel: function() {
            return _HTMLTemplates[_activeHTMLTemplate];
        },

        getDatavizTypeIcon: _getDatavizTypeIcon
    }; // fin return

})();

$(document).ready(function () {
    composer.initComposer();
    wizard.init();
//  textedit.init();
});

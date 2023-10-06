wizard = (function () {
    /*
     * Private
     */

    var _debug = true;

    var _model = null;

    /*
     * Wizard needs data to vizualize dataviz configuration
     * each data sample linked to dataviz is stored for next usage
     * in _storeData
     */
    var _storeData = {};
    var _data  = {};

    /*
     * _dataviz_composer: DOM element configured from the composer
     */
    var _dataviz_composer = null;

    /*
     * _dataviz_infos from admin.getDataviz(datavizId);
     *
     * {
        "dataviz":"epci_surface_batie_lycee",
        "description":"",
        "job":"epci_edr",
        "level":"epci",
        "source":"région Bretagne",
        "title":"Surface bâtie lycée par EPCI",
        "type":"figure",
        "unit":"m²",
        "viz":"{
                    "type":"figure",
                    "data":{},
                    "properties":{
                        "id":"epci_surface_batie_lycee",
                        "model":"b",
                        "unit":"m²",
                        "icon":"icon-appartement"
                    }
            },
        "year":"2020"
        }
     */
    var _dataviz_infos = {};

    /*
     * _dataviz_definition
     *
     * store the last return by _form2json then used by admin.saveVisualization()
     * to store dataviz definition in dataviz table
     *{
        "type": type,
        "data": fdata,
        "properties": properties
      }
     */
    var _dataviz_definition = {};
    var _default_definition = {};

    /*
     * _piklor_instances - Store all piklor instances created (with a numeric index as key)
     */
    var _piklor_instances = {};

    /** TODO
     * Method to extract a set of data in relation with dataviz
     * and necessary to configure and visualize a dataviz for a report
     * Result is stored in _storeData[xxx] to reuse it later
     * @param  {string} datavizId
     */
    var _getSampleData = function (datavizId) {
if (_debug) console.debug("Wizard sample data for :", datavizId);
        // function countUnique is used to test if labels linked to dataviz are unique or not.
        function countUnique(iterable) {
            return new Set(iterable).size;
        }
        //get sample data linked to dataviz, format it and store it for later
        $.ajax({
            dataType: "json",
            type: "GET",
            url: [report.getAppConfiguration().api, "store", datavizId, "data/sample"].join("/"),
            success: function (data) {
                if (data.data) {
                    //update local data
                    var tmp_data = {
                        "dataset": {}
                    };
                    var formatedData = {
                        "dataset": [],
                        "data": [],
                        "label": [],
                        "rows": 0,
                        "significative_label": false
                    };
                    //test multilines and format data and populate formatedData
                    if (data.data.length === 1) {
                        //eg figure : data = {"data":"1984","dataset":"bigbrother","label":"Roman de G. Orwell","order":1}
                        var a = data.data[0];
                        formatedData = {
                            "dataset": [a.dataset],
                            "data": [a.data],
                            "label": [a.label],
                            "rows": 1,
                            "significative_label": true
                        };
                    } else {
                        /* eg graph with 2 datasets: data = [
                            {"data":"10","dataset":"voitures","label":"2019","order":1},
                            {"data":"15","dataset":"voitures","label":"2020","order":2},
                            {"data":"12","dataset":"vélos","label":"2019","order":1},
                            {"data":"13","dataset":"vélos","label":"2020","order":2}
                        ]
                           or graph with one dataset  : data = [
                            {"data":"75%","dataset":"budget","label":"disponible","order":1},
                            {"data":"25%","dataset":"budget","label":"dépensé","order":2}
                           ]
                        */
                        data.data.forEach(function (item) {
                            if (tmp_data.dataset[item.dataset]) {
                                tmp_data.dataset[item.dataset].data.push(item.data);
                                tmp_data.dataset[item.dataset].label.push(item.label);
                            } else {
                                tmp_data.dataset[item.dataset] = {
                                    "data": [item.data],
                                    "label": [item.label]
                                };
                                formatedData.dataset.push(item.dataset);
                            }
                        });
                        /* if more than one dataset store data and labels in this model :
                         *   [
                                [dataset1.value1, dataset1.value2],
                                [dataset2.value1, dataset2.value2]
                            ]
                        */
                        if (formatedData.dataset.length > 1) {
                            formatedData.dataset.forEach(function (dataset) {
                                formatedData.data.push(tmp_data.dataset[dataset].data);
                                formatedData.label.push(tmp_data.dataset[dataset].label);
                            });
                            formatedData.rows = formatedData.data[0].length;
                            // Test if labels are significative. If then labels can be used as column in table dataviz
                            formatedData.significative_label = (countUnique(formatedData.label[0]) > 1);

                        } else {
                            /* Put directly data and labels from the unique dataset
                                [value1, value2]
                            */
                            formatedData.data = tmp_data.dataset[formatedData.dataset[0]].data;
                            formatedData.label = tmp_data.dataset[formatedData.dataset[0]].label;
                            formatedData.rows = formatedData.data.length;
                            // Test if labels are significative. If then labels can be used as column in table dataviz
                            formatedData.significative_label = (countUnique(formatedData.label[0]) > 1);
                        }
                    }

                    _storeData[datavizId] = formatedData;

                } else {
                    console.log("Erreur : Impossible de récupérer l'échantillon de données : " + data);
                }
            },
            error: function (xhr, status, error) {
                console.log(error);
            }
        });
    };

    /**
     * _clean - Method to clear wizard form and modal data
     */
    var _clean = function () {
console.log('CALL _clean');
        _dataviz_composer = null;
        _dataviz_infos = {};
        _dataviz_definition = {};
        _default_definition = {};
        $("#wizard-parameters .nav-tabs>.nav-item").first().tab('show');
        $("#dataviz-attributes").hide();
        $("#wizard-form-apply").prop("disabled", true);
        // remove all form values
        document.getElementById("w_dataviz_type").value = "";
        document.querySelectorAll(".dataviz-attributes").forEach((el) => {
            if (el.type == 'checkbox') el.checked = false; else el.value = "";
        });
        // remove color pickers
        document.querySelectorAll("#color-pickers .color-picker-wrapper .available-colors").forEach((el) => { el.remove(); });
        document.querySelectorAll("#color-pickers .color-picker-wrapper .btn-color").forEach((el) => { el.remove(); });
        Object.keys(_piklor_instances).forEach((index) => { delete _piklor_instances[ index ]; });
        // remove dataviz id references
        document.getElementById("wizard-panel").dataset.relatedId = "";
        document.getElementById("wizard-panel").querySelector(".modal-title tt").innerText = "";
        // remove existing result
        document.getElementById("wizard-code").innerText = "";
        $("#wizard-result div").remove();
        $("#wizard-result").addClass("preloader");
        // remove preview css from selected template
        $("#wizard-result style").remove();
        document.getElementById("wizard-view").querySelector("STYLE").innerHTML = "";
    };

    /**
     * _initDatavizTypeOptions - Method to configure wizard options with dataviz capabilities
     * Update options in select control #w_dataviz_type
     * @param  {string} datavizId
     */
    var _initDatavizTypeOptions = function (datavizId) {
console.log('CALL _initDatavizTypeOptions', datavizId);
        let select = document.querySelector('select#w_dataviz_type');
        if (! select) return console.error("Sélecteur du type de dataviz non disponible");
        
        var _data = _storeData[datavizId];
        if (_debug) console.debug("configure wizard options - samples data for "+ datavizId + ":\n", _data);
        
        let data_type = "text";
        if (_data.data && _data.data[0]) {
            if (_data.dataset.length === 1) {
                const reUrl = new RegExp(/^((http[s]?|ftp):\/)?\/?([^:\/\s]+)((\/\w+)*\/)([\w\-\.]+[^#?\s]+)(.*)?(#[\w\-]+)?$/);
                if      (reUrl.test(_data.data[0]))            data_type = "url";
                else if (_data.data[0].startsWith("POINT"))    data_type = "geom";
            } else if (_data.data[0][0]) {
                if      (_data.data[0][0].startsWith("POINT")) data_type = "geom";
            }
        }
        
        let options = [];
        if (data_type === "geom") options.push("map");
        // many datasets || One dataset with multiple lines => table, chart
        if (_data.dataset.length > 1 || _data.rows > 1) {
            options.push("chart");
            if (_data.significative_label) options.push("table");
        }
        // one dataset only (1 dataset une seule ligne => figure, text, iframe, image)
        else if (data_type === "text") {
            options.push("figure", "text");
        }
        else if (data_type === "url") {
            options.push("iframe", "image");
        }
        
        // remove all existing options and generate the new ones
        while (select.options.length > 0) select.remove(0);
        select.add(new Option("...", ""), undefined);
        for (let i = 0; i < options.length; i++) select.add(new Option(options[i], options[i]), undefined);
    };

    /**
     * _json2form - Method to populate wizard form parameters from dataviz definition
     * @param  {object} viz
     */
    var _json2form = function (viz) {
console.log('CALL _json2form', viz);
        let input;
        for (const [attribute, value] of Object.entries(viz.properties)) switch (attribute) {
            case "id":
                input = document.getElementById("wizard-panel");
                if (input && ! input.dataset.relatedId) input.dataset.relatedId = value;
                break;
            case "model":
                input = document.getElementById("selectedModelWizard");
                if (input && ! input.value) input.value = value;
                break;
            case "columns" :  // hugly
                input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="'+attribute+'"]');
                if (! input) console.warn("json2form error : aucun input pour la propriété " + attribute);
                else input.value = ( (value[0] === 1) ? value.map(x => x - 1) : value );
                break;
            default:
                input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="'+attribute+'"]');
                if (! input) console.warn("json2form error : aucun input pour la propriété " + attribute);
                else if (input.type == "checkbox") input.checked = (value === 'true') ? true : false;
                else input.value = value;
        }
        document.getElementById("w_dataviz_type").value = viz.type;
    };

    /**
     * _showFormParameters - Method to show fields linked to dataviz type (table, figure, chart...)
     * @param  {string} datavizType
     */
    var _showFormParameters = function (datavizType) {
        // adaptation du libellé de la propriété "label" selon le type chart|table
        let input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="label"]');
        if (input) input = input.closest(".attribute");
        if (input) input = input.querySelector(".input-group-text");
        if (input) switch (datavizType) {
            case "chart" : input.innerText = "séries"; break;
            case "table" : input.innerText = "labels"; break;
        }
        // affichage uniquement des champs du formulaire correspondants au type
        $("#dataviz-attributes .attribute").hide();
        $("#dataviz-attributes .attribute.type-" + datavizType).show();
        $("#dataviz-attributes").show();
        $("#wizard-form-apply").prop("disabled", false);
    };

    /**
     * _initFormParameters - Method to set values from dataviz config and populate wizard form.
     * @param  {object} cfg
     * ex: { "type":"figure", "properties":{ "unit": "m²", "colors": "orange,blue" } }
     */
    var _initFormParameters = function (cfg) {
console.log('CALL _initFormParameters', cfg);
        if (! cfg.properties || ! cfg.properties.id) return;
        
        // update wizard form with dataviz values
        _json2form(cfg);
        
        let _data = _storeData[cfg.properties.id];
        let input;
        
        // set colors for Piklor lib
        input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="colors"]');
        if (input) input.value.split(',').forEach((color) => _createColorPicker(color, _data.dataset.length));
        
        // disable some input fields
        input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="stacked"]');
        if (input) input.setAttribute("disabled", (_data.dataset.length > 1) ? false : true);
        input = document.querySelector('#dataviz-attributes .dataviz-attributes[data-prop="extracolumn"]');
        if (input) input.setAttribute("disabled", (_data.significative_label) ? false : true);
        
        // show fields linked to dataviz type (table, figure, chart...)
        _showFormParameters(cfg.type);
    };

    /**
     * _createColorPicker - Method to set a new Piklor instance for a new color to edit
     * @param  {string} color_code
     * @param  {int} nb_datasets
     */
    var _createColorPicker = function (color_code = null, nb_datasets = null) {
console.log('CALL _createColorPicker', color_code, nb_datasets);
        if (! color_code) color_code = '#ffffff';
        if (! nb_datasets) nb_datasets = (typeof _data !== "undefined") ? _data.dataset.length : 1; // TODO: pour limiter le add ?
        let index = (Math.max(0, Math.max(...Object.keys( _piklor_instances ))) || 0) + 1;
        
        let button = document.createElement('button');
        button.className = "btn-color piklor-" + index;
        button.style.backgroundColor = button.dataset.color = color_code;
        button.innerHTML = "&nbsp;";
        let palette = document.createElement('div');
        palette.className = "available-colors piklor-" + index;
        let wrapper = document.querySelector("#color-pickers .color-picker-wrapper");
        wrapper.appendChild(button);
        wrapper.appendChild(palette);
        
        let input = document.querySelector("#color-pickers input.dataviz-attributes");
        let pk = new Piklor(palette, (_model.colors) ? _model.colors : [], {
            closeOnBlur: true,
            manualInput: true,
            removeColor: true,
            open: button
        })
        pk.colorChosen(function (color) {
            if (this.options.open) this.options.open.style.backgroundColor = (color !== false) ? color : "";
            let colors = Array.from(wrapper.querySelectorAll("button.btn-color"), (btn) => btn.dataset.color);
            if (input) input.value = colors.join(",");
        });
        _piklor_instances[ index ] = pk;
        
        if (input) input.style.display = "none";
    };

    /**
     * _initDatavizDefinition - Aggrégation des définitions par défaut et configurées pour l'initialisation du formulaire
     */
    var _initDatavizDefinition = function () {
        let nb_datasets = (_data.dataset) ? _data.dataset.length : 0;
        
        // set default values for wizard form
        let properties = {
            "id":           _dataviz_infos.dataviz     || "",
            "title":        _dataviz_infos.title       || "",
            "description":  _dataviz_infos.description || "",
            "unit":         _dataviz_infos.unit        || "",
            "type":         "bar",
            "icon":         "icon-default",
            "iconposition": "custom-icon",
            "zoom":         12,
            "opacity":      "0.75",
            "ratio":        "2:1",
//          "colors":       _model.colors.slice(0, nb_datasets),
            "label":        (nb_datasets > 1) ? _data.dataset : ["Légende"],
            "columns":      Array( nb_datasets ).fill().map((v,k) => k+1),
            "extracolumn":  (_data.significative_label) ? "#" : "",
            "stacked":      false,
            "begin0":       true,
            "hidelegend":   false,
            "showlabels":   false,
        };
        
        // get default dataviz configuration (stored if needed later for a reset to default action)
        if (_dataviz_infos.viz) {
            let viz = _dataviz_infos.viz.trim();
            if (viz) try {
                _default_definition = JSON.parse( viz );
                if (_default_definition.properties) {
                    // application de correctifs : propriété "title" sous forme objet à convertir en texte
                    if (_default_definition.properties.title && _default_definition.properties.title.charAt(0) == '{') try {
                        let otitle = JSON.parse( _default_definition.properties.title );
                        if (otitle.text) _default_definition.properties.title = otitle.text;
                    } catch (e) {}
                }
                if (_debug) console.debug("Dataviz default definition:\n", _default_definition);
            } catch (e) { console.warn("Dataviz default definition is invalid", viz, e); }
        }
        if (! _default_definition.properties) _default_definition.properties = {};
        
        // get the current report dataviz definition (if called from the composer)
        let compose_definition = {};
        if (_dataviz_composer) {
            let compose_code = _dataviz_composer.querySelector("code.dataviz-definition");
            let viz = (compose_code) ? compose_code.innerText.trim() : "";
            if (viz) try {
                compose_definition = JSON.parse( viz );
                if (_debug) console.debug("Dataviz composer definition:\n", compose_definition);
            } catch (e) { console.warn("Dataviz compose definition is invalid", viz, e); }
        }
        if (! compose_definition.properties) compose_definition.properties = {};
        
        // and merge with the current definition from composer
        let definition = Object.assign({}, _default_definition, compose_definition);
        definition.properties = Object.assign(properties, _default_definition.properties, compose_definition.properties);
        if (! definition.type) definition.type = _dataviz_infos.type;
        return definition;
    };

    /**
     * _onWizardOpened - This method is linked to open wizard modal event,
     * it initialize.the form for the dataviz to configure and generate the preview
     * @param  {event} ev
     */
    var _onWizardOpened = function (ev) {
console.log('CALL _onWizardOpened', ev);
        // clear wizard form and current data
        _clean();
        
        // detect wich component calls this and what render model to use for previews
        let modelId = document.getElementById("selectedModelWizard").value;
        if (ev.relatedTarget.dataset.component === "composer") {
            // store dataviz DOM element edited from the composer
            _dataviz_composer = ev.relatedTarget.closest(".dataviz-item");
            if (! _dataviz_composer) { console.error("Wizard: dataviz non retrouvée dans le composer"); return; }
            // buttons: enable "add to report" / disable "select model"
            document.getElementById("wizard-compose-save").classList.remove("hidden");
            document.getElementById("selectedModelWizard").disabled = true;
            modelId = composer.getModelId() || modelId || "composer";
        } else {
            // buttons: disable "add to report" / enable "select model"
            document.getElementById("wizard-compose-save").classList.add("hidden");
            document.getElementById("selectedModelWizard").disabled = false;
            modelId = modelId || composer.getModelId() || "composer";
        }
        
        // get datavizid linked to the wizard modal
        let datavizId = ev.relatedTarget.dataset.relatedId;
        if (! datavizId) { console.error("Wizard: dataviz à configurer non spécifiée"); return; }
        ev.currentTarget.querySelector(".modal-title tt").innerText = datavizId;
        ev.currentTarget.dataset.relatedId = datavizId;
        
        // get dataviz infos (description, title, unit, viz...) if exists
        _dataviz_infos = admin.getDataviz(datavizId);
        if (_debug) console.debug("Dataviz store informations:\n", _dataviz_infos);
        
        // get dataviz definition for wizard (form default + store + composer)
        let definition = _initDatavizDefinition();
        definition.properties.id = datavizId;
        if (_debug) console.debug("Dataviz aggregated definition:\n", definition);
        
        // download data for this dataviz if necessary
//      if (!_storeData[datavizId]) _getSampleData(datavizId);
//      if (!_storeData[datavizId]) _storeData[datavizId] = default_definition.data[datavizId];
        
        // use active model then initialize the wizard form and renderer
        models.load(modelId, function(success, data){
            if (_debug) console.debug("Chargement du modèle pour le rendu de la dataviz :\n", data);
            if (! success) return;
            _model = data;
            document.getElementById("selectedModelWizard").value = _model.ref;
            _updateIconList();
            _updateStyle();
            
            // configure wizard options with dataviz capabilities
            _initDatavizTypeOptions(datavizId);
            // apply config if exists
            _initFormParameters(definition);
            // render dataviz in result panel
            _renderDatavizPreview();
        });
    };

    /**
     * _onChangeDatavizType - This method is linked to #w_dataviz_type select control event change
     * @param  {event} ev
     */
    var _onChangeDatavizType = function (ev) {
console.log('CALL _onChangeDatavizType', ev);
        // show fields linked to dataviz type
        _showFormParameters( ev.target.value );
        // refresh dataviz renderer
        _renderDatavizPreview();
    };

    /** TODO
     * @param  {event} ev
     */
    var _onChangeModel = function (ev) {
console.log('CALL _onChangeModel', ev);
        models.load(ev.target.value, function(success, data){
            if (_debug) console.debug("Changement du modèle pour le rendu de la dataviz :\n", data);
            if (! success) return;
            _model = data;
            document.getElementById("selectedModelWizard").value = _model.ref;
            _updateIconList(); // TODO: utilité ? (les pictos sont communes aux modèles, seules les CSS peuvent changer)
            _updateStyle();
            // TODO: update piklor palettes
        });
    };

    /** TODO
     * this method get icons list from api and show them in wizard
     * and update css model with all icons
     */
    var _updateIconList = function () {
console.log('CALL _updateIconList');
        if (_model.icon_styles) return;
        //update icon store in wizard modal
        var style = "";
        folders = {};
        var tabs = ['<nav><div class="nav nav-tabs" id="icon-nav-tab" role="tablist">'];
        var tabs_content = ['<div class="tab-content" id="icon-nav-tabContent">'];
        $.ajax({
            dataType: "json",
            type: "GET",
            url: [report.getAppConfiguration().api, "picto"].join("/"),
            success: function (icons) {
                var style = "";
                // group icons by folder
                icons.forEach(function(icon) {
                    if (folders[icon.folder]) {
                        folders[icon.folder].push(icon);
                    } else {
                        folders[icon.folder] = [icon];
                    }
                });
                var first = true;
                var tab_class_base = 'nav-item nav-link';
                var tab_class = '';
                var content_class_base = 'tab-pane fade';
                var content_class ='';
                for (const [folder, icons] of Object.entries(folders).sort()) {
                    var icon_list = ['<ul class="icon-picker-list">'];
                    icons.forEach(function(icon) {
                        style += '\n.'+icon.id+' { background-image: url('+icon.url+');}';
                        icon_list.push('<li data-class="'+icon.id+'" class="custom-icon ' + icon.id + '"></li>');
                    });
                    //close icon-picker-list
                    icon_list.push('</ul>');
                    var items = icon_list.join("");
                    tab_class = tab_class_base;
                    content_class = content_class_base;
                    if (first) {
                        tab_class += ' active';
                        content_class += ' show active';
                        first = false;
                    }
                    tabs.push(`<a class="${tab_class}" id="icon-${folder}-tab"
                        data-toggle="tab" href="#icon-${folder}-content"
                        role="tab" aria-controls="icon-${folder}-content"
                        aria-selected="true">${folder}</a>`);
                    tabs_content.push(`<div class="${content_class}" id="icon-${folder}-content"
                        role="tabpanel" aria-labelledby="icon-${folder}-tab">${items}</div>`);
                }

                //close tabs elements
                tabs_content.push('</div>');
                tabs.push('</div></nav>');
                var html = tabs.join(" ") + "\n" + tabs_content.join(" ");
                $("#wizard-icons").html("");
                $("#wizard-icons").append(html);
                $(".icon-picker-list li.custom-icon").click(function (e) {
                    var icon = e.currentTarget.dataset.class;
                    $("#w_icon").val(icon);
                    document.querySelector(".card-container").classList.toggle('backcard');
                })
                _model.icon_styles = style;
                _updateStyle();
            },
            error: function (xhr, status, error) {
                console.log(error);
            }
        });
    };

    /** TODO
     * Update style in wizard modal
     */
    var _updateStyle = function () {
console.log('CALL _updateStyle');
        document.querySelector("#wizard-view style").innerHTML = [
            _model.page_styles,  //get current/default style
            _model.icon_styles,  //add icon style
        ]. join("\n");
    };

    /**
     * _form2json - This method get values from wizard form parameters
     * and populate a json config object (dataviz definition)
     */
    var _form2json = function () {
console.log('CALL _form2json');
        let dvz_type = document.getElementById("w_dataviz_type").value;
        let properties = {
            "id":    document.getElementById("wizard-panel").dataset.relatedId,
            "model": document.getElementById("selectedModelWizard").value,
        };
        document.querySelectorAll("#dataviz-attributes .attribute.type-"+dvz_type+" .dataviz-attributes").forEach((input) => {
            const val  = (input.type == 'checkbox') ? input.checked : input.value;
            const prop = input.dataset.prop;
            if (prop) switch (prop) {
                case "label":
                case "colors":
                    properties[ prop ] = val.split(",");
                    break;
                case "columns":
                    properties[ prop ] = val.split(",").map((v) => Number(v));
                    break;
                default:
                    properties[ prop ] = val;
            }
        });
        // store config dataviz in json object
        _dataviz_definition = {
            "type": dvz_type,
            "properties": properties
        };
        if (_debug) console.debug("Configuration JSON générée par le formulaire :\n", _dataviz_definition);
        return _dataviz_definition;
    };

    /**
     * _renderDatavizPreview. This method pass a config object to the report.testViz method.
     * Used by #wizard_refresh button and the auto render method in _onWizardOpened
     */
    var _renderDatavizPreview = function () {
console.log('CALL _renderDatavizPreview');
        let viz = _form2json();
        
        // get dataviz component herited from template and set attributes with properties object
        let html = _model.renderDataviz(viz);
        document.getElementById("wizard-code").innerText = html.outerHTML;
        
        // render result in wizard modal
        let container = document.getElementById("wizard-result");
        if (container) {
            container.innerHTML = "";
            container.appendChild(html);
            container.classList.remove("preloader");
        }
        
        // draw dataviz with data, type and properties
        let fdata = {}; fdata[ viz.properties.id ] = _storeData[ viz.properties.id ];
        report.testViz(fdata, viz.type, viz.properties);
    };

    /**
     * _saveDatavizComposer - This method copy paste dataviz html code between  wizard result and composition
     * @param  {string} datavizId
     */
    var _saveDatavizComposer = function () {
console.log('CALL _saveDatavizComposer');
        if (! _dataviz_composer) { console.error("Dataviz en cours d'édition à configurer non disponible"); return; }
        // update dataviz definition in the composer
        composer.configDataviz(_dataviz_composer, _dataviz_definition);
        // close wizard modal (clean on close event)
        $("#wizard-panel").modal("hide");
    };

    /**
     * _onWizardClose - 
     */
    var _onWizardClose = function () {
console.log('CALL _onWizardClose');
        _clean();
    };

    /**
     * this method initializes wizard
     */
    var _init = function () {
console.log('CALL _init');
        Chart.plugins.unregister(ChartDataLabels);
        // load wizard html dynamicly and append it admin.html
        $.ajax({
            url: "/static/html/wizard.html",
            dataType: "text",
            success: function (html) {
                $("body").append(html);
                // events management
                $('#wizard-panel').on('show.bs.modal', _onWizardOpened);
                $('#wizard-panel').on('hide.bs.modal', _onWizardClose);
                $("#selectedModelWizard").on('change', _onChangeModel);
                $("#w_dataviz_type").on('change', _onChangeDatavizType);
                $("#wizard-form-apply").on('click', _renderDatavizPreview);
                $("#wizard-compose-save").on('click', _saveDatavizComposer);
                $("#wizard-default-save").on('click', function(e){ admin.saveVisualization(_dataviz_definition); });
                $("#color-pickers .color-picker-add").on('click', function(e){ _createColorPicker(); });
            }
        });
    };

    /*
     * Public
     */
    return {
        /* used by composer.js & report.js */
        init:               _init,
        /* used by composer.js */
        getSampleData:      _getSampleData,         // TODO: à supprimer
    };

})();

/**
 *
 * Commande de debug à lancer dans la console JS :
 * - pour tester l'encodage en json       : saver.testHtml2Json("/mreport/epci_population/report_composer.html")
 * - pour tester la reconstruction html   : saver.testJson2Html("/mreport/epci_population/report_composer.html")
 */
saver = (function () {
    /*
     * Private
     */

    class JsonReport {
        constructor() {
            this.title = "",
            this.theme = composer.activeModel().id;
            this.blocs = [];
            this.confs = {};
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

    const reType = new RegExp('^(.* )?layout-(cell|cols|rows)( .*)?$');
    const reSize = new RegExp('^(.* )?col-([0-9]+)');

    /**
     *
     */
    var _parseBlocLayout = function (node) {
        let structure = {};
        let result;
        
        result = node.className.match(reType);
        if (result !== null) structure.type = result[2];
        else return;
        
        result = node.className.match(reSize);
        if (result !== null) structure.size = result[2];
        
        if (structure.type !== 'cell') {
            // récursion sur les structures enfants d'un layout-rows ou layout-cols
            structure.bloc = []
            for (var i = 0; i < node.childElementCount; i++) {
                result = _parseBlocLayout(node.children[i]);
                if (result) structure.bloc.push(result);
            }
            if (! structure.bloc.length) delete structure.bloc;
        } else {
            // recherche des dataviz listées dans le conteneur d'un layout-cell
            structure.data = []
            node.querySelectorAll(".dataviz-container .dataviz").forEach(function (dvz) {
                structure.data.push( dvz.dataset.dataviz );
            });
        }
        
        return structure;
    }

    /**
     * _composition2json : Export DOM structures to JSON data.
     */
    var _composition2json = function (composition) {
        let jsonReport = new JsonReport();
        
        // Loop on blocs
        for (let i = 0; i < composition.childElementCount; i++) {
            const child  = composition.children[i];
            const blocRef = child.dataset.bloc;
            if (! blocRef) continue;
            
            let jsonBloc = new JsonBloc(blocRef);
            jsonBloc.type    = child.className.match(/structure-(bloc|element)/)[1];
            jsonBloc.title   = child.querySelector(".structure-html .bloc-title");
            jsonBloc.layout  = _parseBlocLayout(child.querySelector(".structure-html .bloc-content"));
            jsonBloc.sources = child.querySelector(".structure-html .bloc-sources");
            
            jsonReport.blocs.push(jsonBloc);
        }

/*
        // Loop on dataviz definitions
                let properties = false;
                if (definition.textContent) {
                    let dvz_element = parser.parseFromString(definition.textContent, "text/html").querySelector(".dataviz");
                    properties = dvz_element.dataset;
                    properties.dataviz_class = dvz_element.className.match(/report-*(chart|figure|text|table|map|title|image|iframe)/)[1];
                }
                jsonReport.configuration[datavizid] = properties;


        var blocs = [];
        composition.querySelectorAll("#report-composition > .list-group-item").forEach(function (bloc_item, blocidx) {
            let bloc_type = bloc_item.className.match(/structure-*(bloc|element)/)[1];
            if (bloc_type === "bloc") {
                //report-bloc
                let bloc = bloc_item.querySelector(".report-bloc");
                if (bloc) {
                    let _bloc = new Bloc();

                    //get bloc-description (ref)
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

                    //get columns first level of bloc-content
                    let level_1 = _getDivisions(bloc.querySelector("div > .bloc-content > .row"));
                    //Hack division from col-md-12
                    if (level_1.divisions.length === 1 && !level_1.divisions[0].isContainer) {
                        level_1.divisions = _getDivisions(level_1.divisions[0].childrens).divisions;
                    }
                    level_1.divisions.forEach(function(c, divisionidx) {
                        if (c.childrens) {
                            c.divisions = _getDivisions(c.childrens).divisions;
                            c.divisions.forEach(function(c, divisionidx) {
                                if (c.childrens) {
                                    c.divisions = _getDivisions(c.childrens).divisions;
                                    c.divisions.forEach(function(c) {
                                        if (c.childrens) {
                                            var level_4 = _getDivisions(c.childrens);
                                        }
                                        delete c.childrens;
                                    })
                                }
                                delete c.childrens;
                            });
                            delete c.childrens;
                        } else {
                            _bloc.divisions = level_1.divisions;
                        }
                        delete c.childrens;
                    });
                    _setBlocDefinition(_bloc);
                    blocs.push(_bloc);
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
        })

        jsonReport.structure.blocs = blocs.map(function(b) {
            switch (b.type) {
                case "BlocElement": return { 'type': b.type, 'text': b.text, 'style': b.style };
                case "BlocTitle":   return { 'type': b.type, 'title': b.title };
                case "Bloc":        return { 'type': b.type, 'model': b.model, 'layout': b.definition, 'sources': b.sources, 'title': b.title };
            }
            return { 'type': b.type }
        })
*/
        console.log('Objet Report créé à partir de la page composition : ', jsonReport);
        return jsonReport
    };


    var _saveJsonReport = function (report_id, report_data, theme) {
        $.ajax({
            dataType: "json",
            contentType: "application/json",
            type: "PUT",
            url: [report.getAppConfiguration().api, "backup", report_id].join("/"),
            data: JSON.stringify(report_data),
            dataType: 'json',
            success: function (data) {
                if (data.response === "success") {
                    console.log(data);
                } else {
                    var err = data.error || data.response;
                    Swal.fire(
                        'Une erreur s\'est produite',
                        'La définition du rapport n\'a pas pu être enregistrée <br> (' + err + ')',
                        'error'
                    );
                }
            },
            error: function (xhr, status, error) {
                var err = _parseError(xhr.responseText);
                Swal.fire(
                    'Une erreur s\'est produite',
                    'L\'API ne réponds pas <br> (' + err + ')',
                    'error'
                );
            }
        });
    };

    _setBlocDefinition = function (bloc) {
        //Get first level
        bloc.divisions.forEach(function (div0, div0idx) {
            let properties0 = {"w":div0.style.replace( /^\D+/g, ''), "division_type":div0.type};
            if (div0.dataviz) {
                properties0.dataviz =  div0.dataviz;
            } else if (div0.isContainer) {
                properties0.dataviz = false;
            }
            bloc.definition[`${div0idx}_0`] = properties0;
            //Get next level
            if (!div0.isContainer && div0.divisions) {
                div0.divisions.forEach(function (div1,div1idx) {
                    let properties1 = {"w":"", "division_type":div1.type};
                    if (div1.type === "H") {
                        properties1.w = div1.style.replace( /\D+/g, '');
                    } else {
                        //vertical div
                        properties1.h = div1.style.replace( /\D+/g, '');
                        //get subdivisions
                        if (!div1.isContainer && div1.divisions) {
                            div1.divisions.forEach(function (div11,div11idx) {
                                //properties1 = {"w":"", "division_type":div1.type};
                                if (div11.type === "H") {
                                    properties1.w = div11.style.replace( /\D+/g, '');
                                }
                                if (div1.type === 'V') {
                                    properties1.h = div1.style.replace( /\D+/g, '');
                                }
                                if (div11.dataviz) {
                                    properties1.dataviz =  div11.dataviz;
                                } else if (div11.isContainer) {
                                    properties1.dataviz = false;
                                }
                            });
                        }
                    }
                    if (div1.dataviz) {
                        properties1.dataviz =  div1.dataviz;
                    } else if (div1.isContainer) {
                        properties1.dataviz = false;
                    }
                    bloc.definition[`${div0idx}_${div1idx + 1}`] = properties1;

                });
            }
        });
    }


    var _createBlocStructure = function (bloc_properties) {
        let tpls = {
            "B": '<div class="report-bloc"></div>',
            "R": '<div class="customBaseColumn col-md-{{w}}"></div>',
            "H": '<div class="customBaseColumn col-md-{{w}}"></div>',
            "V": '<div class="h-50 verticalDivision"><div class="customBaseColumn col-md-{{w}}"></div></div>'
        }

        //Get number of root cells
        let parts = [];
        let indexes = [];
        //Get number of root cells (0_0, 1_0...)
        Object.keys(bloc_properties).forEach(function (key) {
            if (key.match(/_0$/)) { indexes.push(key.split("_0")[0]); }
        });
        var parser = new DOMParser();
        indexes.forEach(function (index) {
            //get first level
            let parent = bloc_properties[`${index}_0`];
            let childElements = [];
            let parentElement =  parser.parseFromString(tpls["R"].replace("{{w}}", parent.w), "text/html").querySelector(".customBaseColumn");
            //Extract second level for index cell 1-1, 1_2 ...
            for (const [key, properties] of Object.entries(bloc_properties)) {
                const matcher = new RegExp(`^${index}_[1-4]{1}$`);
                if ( matcher.test(key) ) {
                    childElements.push(parser.parseFromString(tpls[properties.division_type].replace("{{w}}", properties.w), "text/html").querySelector("div"));
                }
            }
            childElements.forEach(function(child) {
                parentElement.append(child);
            });
            parts.push(parentElement);
        });
        // create response
        let blocElement =  parser.parseFromString(tpls["B"], "text/html").querySelector(".report-bloc");
        parts.forEach(function (part) {
            blocElement.append(part);
        });
        return blocElement;


    };


    var _json2composition = function (jsonReport) {
        // config test
        let jsonSample = JSON.parse(`{"configuration":{"epci_title":{"dataviz_class":"title"},"epci_pop_en_cours":{"model":"b","icon":"icon-blue-habitants","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_densite_en_cours":{"model":"b","unit":" hab/km²","icon":"icon-blue-densite2","iconposition":"custom-icon","title":"","description":"","dataviz_class":"figure"},"epci_pop_evolution":{"title":"Evolution nombre d'habitant·e·s dans l'EPCI","description":"","model":"b","type":"line","label":"Légende","colors":"#005a66","opacity":"0.2","ratio":"2:1","stacked":"false","begin0":"true","hidelegend":"true","showlabels":"false","dataviz_class":"chart"},"epci_pop_comparaison_pays_region":{"title":"Taux d'évolution de la population municipale comparée de 2012 à 2017","description":"","model":"b","type":"bar","label":"Légende","colors":"#0094ab,#005a66,#005a66","opacity":"1","ratio":"2:1","stacked":"false","begin0":"true","hidelegend":"true","showlabels":"false","dataviz_class":"chart"},"epci_pop_repartition_f_en_cours":{"model":"b","unit":" %","icon":"icon-blue-femme","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_repartition_h_en_cours":{"model":"b","unit":" %","icon":"icon-blue-homme","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_categorie_age_en_cours":{"title":"Répartition de la population selon la classe d'âge en 2017","description":"","model":"b","label":"EPCI,Région","colors":"#0094ab,#005a66","opacity":"1","ratio":"2:1","stacked":"false","begin0":"true","hidelegend":"false","showlabels":"false","dataviz_class":"chart"},"epci_pop_categorie_csp_en_cours":{"title":"Répartition de la population selon les catégories socio-professionnelles (CSP) en 2017","description":"<ul>Les catégories socio-professionnelles<li>CS1: Agriculteur·rice·s exploitants </li><li>CS2: Artisan·e·s, Commerçant·e·s, Chef·fe·s d'entreprise</li><li>CS3: Cadres, Professions intellectuelles supérieures </li><li>CS4: Professions intermédiaires</li><li>CS5: Employé·e·s </li><li>CS6: Ouvrier·ère·s </li><li>CS7: Retraité·e·s </li><li>CS8: Autres, Sans activité professionnelle</li></ul>","model":"b","label":"EPCI,Région","colors":"#0094ab,#005a66","opacity":"1","ratio":"2:1","stacked":"false","begin0":"true","hidelegend":"false","showlabels":"false","dataviz_class":"chart"},"epci_pop_menage_famillemono_en_cours":{"model":"b","unit":" %","icon":"icon-blue-menage_mono","iconposition":"custom-icon","dataviz_class":"figure"},"epci_revenu_median":{"model":"b","unit":" €","icon":"icon-blue-revenu","iconposition":"custom-icon","dataviz_class":"figure"},"epci_revenu_taux_pauvrete":{"model":"b","unit":" %","icon":"icon-blue-social_tx_pauvrete","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_formation_sans_diplome_en_cours":{"model":"b","unit":" %","icon":"icon-blue-social_diplome","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_logement_statut_en_cours":{"title":"Répartition des logements selon le statut en 2017","description":"","model":"b","type":"bar","label":"EPCI,Région","colors":"#0094ab,#005a66","opacity":"1","ratio":"3:2","stacked":"false","begin0":"true","hidelegend":"false","showlabels":"false","dataviz_class":"chart"},"epci_pop_logement_type_en_cours":{"title":"Répartition des logements selon le type en 2017","description":"","model":"b","type":"pie","label":"Légende","colors":"#0094ab,#005a66","opacity":"1","ratio":"3:2","stacked":"false","begin0":"false","hidelegend":"false","showlabels":"true","dataviz_class":"chart"},"epci_pop_logement_nb_personne_en_cours":{"model":"b","icon":"icon-yellow-house_person","iconposition":"custom-icon","dataviz_class":"figure"},"epci_pop_logement_hlm_taux_en_cours":{"model":"b","unit":" %","icon":"icon-yellow-hlm_tx","iconposition":"custom-icon","dataviz_class":"figure"}},"structure":{"blocs":[{"title":"epci_title","type":"BlocTitle"},{"text":"La population du territoire","style":"titre-1","type":"BlocElement"},{"layout":{"0_0":{"w":"4","division_type":"H"},"0_1":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_en_cours"},"0_2":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_densite_en_cours"},"1_0":{"w":"4","division_type":"H","dataviz":"epci_pop_evolution"},"2_0":{"w":"4","division_type":"H","dataviz":"epci_pop_comparaison_pays_region"}},"sources":"SOURCE: INSEE publication 2020","title":{"title":"Démographie","style":"titre-2"},"type":"Bloc"},{"layout":{"0_0":{"w":"6","division_type":"H"},"0_1":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_repartition_f_en_cours"},"0_2":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_repartition_h_en_cours"},"1_0":{"w":"6","division_type":"H","dataviz":"epci_pop_categorie_age_en_cours"}},"sources":"SOURCE: INSEE publication 2020","title":{},"type":"Bloc"},{"layout":{"0_0":{"w":"6","division_type":"H","dataviz":"epci_pop_categorie_csp_en_cours"},"1_0":{"w":"6","division_type":"H","dataviz":"epci_pop_menage_famillemono_en_cours"}},"sources":"SOURCE: INSEE publication 2020","title":{},"type":"Bloc"},{"layout":{"0_0":{"w":"6","division_type":"H","dataviz":"epci_revenu_median"},"1_0":{"w":"6","division_type":"H","dataviz":"epci_revenu_taux_pauvrete"}},"sources":"SOURCE: INSEE publication 2020","title":{"title":"Revenus","style":"titre-2"},"type":"Bloc"},{"layout":{"0_0":{"w":"12","division_type":"H","dataviz":"epci_pop_formation_sans_diplome_en_cours"}},"sources":"SOURCE: INSEE publication 2020","title":{"title":"Education","style":"titre-2"},"type":"Bloc"},{"layout":{"0_0":{"w":"4","division_type":"H","dataviz":"epci_pop_logement_statut_en_cours"},"1_0":{"w":"4","division_type":"H","dataviz":"epci_pop_logement_type_en_cours"},"2_0":{"w":"4","division_type":"H"},"2_1":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_logement_nb_personne_en_cours"},"2_2":{"w":"12","division_type":"V","h":"50","dataviz":"epci_pop_logement_hlm_taux_en_cours"}},"sources":"SOURCE: INSEE publication 2020","title":{"title":"Logement","style":"titre-2"},"type":"Bloc"}]},"theme":""}`);
        console.log(jsonSample);
        console.log(jsonReport);

        let parser = new DOMParser();
        let composition = document.createElement("div");
        composition.id = "report-composition";
        let structure = [];
        let _composer_template = "";
        let model = "b";
        jsonReport.structure.blocs.forEach(function(bloc) {
            let _bloc = "";
            switch (bloc.type) {
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

                    dvzConfig.querySelector("code.dataviz-definition").append(dvzElement.outerHTML);


                    let structure_bloc = parser.parseFromString(_composer_template, "text/html").querySelector("div.structure-bloc");
                    structure_bloc.querySelector(".dataviz-container").appendChild(dvzConfig);
                    //stringify bloc element
                    _bloc = structure_bloc.outerHTML;
                    break;
                case "Bloc": // { 'type': b.type, 'layout': b.definition, 'sources': b.sources, 'title': b.title }
                    _structure = _createBlocStructure(bloc.layout);
                    _bloc = composer.templates.blockTemplate.replace("{{{HTML}}}", _structure.outerHTML);
                    break;
                case "BlocElement": // { 'type': b.type, 'text': b.text, 'style': b.style }
                    _bloc = composer.templates.extraElementTemplate[0].replace("{{{TEXT}}}", bloc.text).replace("{{{CLASSE}}}", bloc.style);
                    break;
            }
            structure.push(_bloc);
        });

        let elements = parser.parseFromString(structure.join(""), "text/html").querySelectorAll("body > div");
        elements.forEach(function(element) {
            composition.appendChild(element);
        });

        console.log(composition);
        return composition;
    };


    // TODO
    var _loadJsonReport = function (report_id, jsonReport) {
        var theme = jsonReport.theme; // composer.activeModel().id

        var html = _json2composition(jsonReport);
        if (html) {
            let reportCompo = document.getElementById("report-composition");
            reportCompo.replaceWith(html);
/*
            let alldvz = reportCompo.getElementsByClassName("dataviz");
            for (elem of alldvz) {
                wizard.getSampleData(elem.dataset.dataviz);
            }
                _configureNewBlock(reportCompo.querySelectorAll(".row"));
                    $("#report-composition .structure-bloc").find(".remove").click(function (e) {
                        $(e.currentTarget).closest(".structure-bloc").find(".dataviz").appendTo("#dataviz-items");
                        $(e.currentTarget).closest(".structure-bloc").remove();
                    });
                    $("#report-composition .structure-element").find(".structureElems").click(function (e) {
                        e.currentTarget.parentNode.remove();
                    });
*/
        }
    }

/*
        //test html reconstruction
        let structure = [];
        jsonReport.structure.blocs.forEach(function (bloc) {
            if (bloc.type === "Bloc") {
                structure.push(_createBlocStructure(bloc.definition));
            } else if (bloc.type === "BlocElement") {
                console.log("TODO");
            }
        });
        console.log("Contenu html fabriqué à partir de l'objet Report : ", structure.map(e => e.innerHTML).join(""));
*/

    var _test_html2json = function (document_url) {
        $.ajax({
            url: document_url,
            dataType: "text",
            success: function (html) {
                let _html = document.createElement("div");
                _html.id = "report-composition";
                _html.innerHTML = html;
                console.log('Contenu récupéré à traiter : ', _html);
                let _json = _composition2json(_html);
                console.log('Données JSON générées : ', _json);
            }
        });
    };

    var _test_json2html = function (document_url) {
        var jsonReport = _test_html2json(document_url);
        var html = _json2composition(jsonReport);
        console.log("Contenu html fabriqué à partir de l'objet Report : ", html);
    };


    /*
     * Public
     */

    return {
        exportJson:     _composition2json,
        importJson:     _json2composition,
        saveJsonReport: _saveJsonReport,
        loadJsonReport: _loadJsonReport,
        testHtml2Json:  _test_html2json,
        testJson2Html:  _test_json2html,
    }; // fin return

})();

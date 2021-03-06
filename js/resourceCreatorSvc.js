angular.module("sampleApp").service('resourceCreatorSvc',
    function($q,$http,RenderProfileSvc,appConfigSvc,ResourceUtilsSvc,profileCreatorSvc,
             GetDataFromServer,$localStorage,Utilities,$sce,resourceSvc) {


    var currentProfileEl;     //the profile being used...
    var currentProfile;         //the profile in use
   // var objNodes = {};          //the nodes indexed

    //colours for graph
    var objColours ={};
    objColours.Encounter = '#93FF1A';
    objColours.Condition = '#E89D0C';
    objColours.Observation = '#FF0000';




        //function to capitalize the first letter of a word...
    String.prototype.toProperCase = function () {
        return this.replace(/\w\S*/g, function(txt){return txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase();});
    };

    String.prototype.capitalize = function () {
        var txt = this;
        return txt.charAt(0).toUpperCase() + txt.substr(1);
    };


    //get the extension type (single, complex) and data type from the ExtensionDefinition (StructureDefinition).

    //todo - for now, assume simple
    this.processExtensionDefinition = function(sd){
        var vo = {type:'simple'};
        if (sd && sd.snapshot && sd.snapshot.element) {
            sd.snapshot.element.forEach(function(ed){
                var path = ed.path;
                if (path.indexOf('.value')) {
                    vo.type = ed.type
                }
            })
        }

        return vo;
    };

    return {
        getPatientOrSubjectReferenceED : function(){
            //locate an ED that is a reference to a patient - either 'patient' or 'subject' as the second element in the path
            if (this.currentProfile && this.currentProfile.snapshot && this.currentProfile.snapshot.element) {
                for (var i=0; i<this.currentProfile.snapshot.element.length; i++) {
                    var ed = this.currentProfile.snapshot.element[i];
                    var ar = ed.path.split('.')
                    if (ar.length == 2) {
                        if (ar[1] == 'patient' || ar[1] == 'subject') {
                            return ed;
                            break;
                        }
                    }
                }
            }
        },
        findPatientsByName : function(name) {


            var qry = appConfigSvc.getCurrentDataServer().url + "\Patient?name="+name;
           
            return $http.get(qry);
        },
        getJsonFragmentForDataType : function(dt,results,stuVersion) {
            //create a js object that represents a fragment of data for inclusion in a resource based on the datatype...

            stuVersion = stuVersion || 3;   //some of the datatypes changes in v3..  :(

            var fragment;


            
                //the actual data entry elements will depend on the datatype...
                switch ( dt) {

                    case 'Money':
                        var qty = {value:results.money_amount,units:results.money_units};
                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Money',text,false);
                        break;

                    case 'positiveInt':

                        var qty = parseInt(results.positiveint);
                        var text = results.positiveint;
                        addValue(qty,'positiveInt',text,true);
                        break;

                    case 'integer':
                        var qty = parseInt(results.integer);
                        var text = results.integer;
                        addValue(qty,'integer',text,true);
                        break;

                    case 'decimal':
                        var qty = parseFloat(results.decimal);
                        var text = results.decimal;
                        addValue(qty,'decimal',text,true);
                        break;


                    case 'ContactPoint' :
                        var use = results.ct.use;
                        var system = results.ct.system;
                        var value = results.ct.value;

                        var ct = {use:use,system:system,value:value};
                        addValue(ct,'ContactType',use + " "+ system + " " + value,false);
                        break;

                    case 'HumanName' :
                        var text = results.hn.text;
                        var hn = {use:results.hn.use,text:text};
                        if (results.hn.fname) {
                            hn.given=[results.hn.fname]
                        }
                        if (results.hn.lname) {
                            hn.family=[results.hn.lname]
                        }

                        addValue(hn,'HumanName',text,false);
                        break;

                    case 'Address' :
                        var use = results.addr.use;
                        var text = results.addr.text;
                        var address = {use:use,text:text};
                        addValue(address,'Address',use + " " + text,false);
                        break;


                    case 'Timing' :

                        var timing = {repeat:{}};

                        timing.repeat.duration = results.timing.duration;
                        if (stuVersion == 3) {
                            timing.repeat.durationUnit = results.timing.units;
                        } else {
                            timing.repeat.durationUnits = results.timing.units;
                        }


                        timing.repeat.frequency = results.timing.freq;

                        if (results.timing.freq_max) {
                            timing.repeat.frequencyMax = parseFloat(results.timing.freq_max);
                        }

                        if (results.timing.period) {
                            timing.repeat.period =parseFloat(results.timing.period);
                        }

                        timing.repeat.periodMax = results.timing.period_max;


                        if (stuVersion == 3) {
                            timing.repeat.periodUnit = results.timing.period_units;
                        } else {
                            timing.repeat.periodUnits = results.timing.period_units;
                        }


                        timing.repeat.when = results.timing.when;


                        var daStart = moment(results.timing_start).format();
                        var daEnd = moment(results.timing_end).format();

                        timing.repeat.boundsPeriod = {start: daStart,end: daEnd};

                        var text = results.timingDescription;
                        addValue(timing,'Timing',text,false);

                        break;


                    //---------

                    case 'Ratio' :

                        var numValue = parseFloat(results.ratio_num_amount);
                        var numDenom = parseFloat(results.ratio_denom_amount)

                        var num = {value:numValue,unit:results.ratio_num_units};
                        var denom = {value:numDenom,unit:results.ratio_denom_units};
                        var ratio = {numerator : num,denominator:denom};
                        var text = num.value + " " + num.unit+ " over " + denom.value + " " + denom.unit;
                        addValue(ratio,'Ratio',text,false);
                        break;

                    case 'Quantity' :

                        var qtyValue = parseFloat(results.quantity_amount);
                        var qty = {value:qtyValue,unit:results.quantity_units};
                        var text = qty.value  + " " + qty.units;
                        addValue(qty,'Quantity',text,false);
                        break;

                    case 'Range' :

                        var stValue = parseFloat(results.range_amount_start);
                        var enValue = parseFloat(results.range_amount_end);

                        var st = {value:stValue,unit:results.range_units};
                        var en = {value:enValue,unit:results.range_units};

                        var range = {low:st,high:en};
                        var text = "Between " + st.value + " and " + en.value + " " + st.units;
                        addValue(range,'Range',text,false);

                        break;

                    case 'Annotation' :
                        var anot = {text:results.annotation.text,authorString : results.annotation.authorString};
                        addValue(anot,'Annotation',anot.text,false);
                        break;
                    case 'Narrative' :
                        //add the narrative as a value to the root element
                        profile.snapshot.element[0].valueNarrative = results.narrative;
                        break;
                    case 'string' :
                        addValue(results.string,'String',results.string,true);
                        break;

                    case 'uri' :
                        addValue(results.uri,'uri',results.uri,true);
                        break;

                    case 'date' :

                        var da = moment(results.date_start).format("YYYY-MM-DD");

                        addValue(da,'Date',da,true);
                        break;
                    case 'dateTime' :
                        var da = moment(results.date_start).format();

                        addValue(da,'DateTime',da,true);

                        break;
                    case 'instant' :

                        var time = moment(results.time); //the time component. the date is set to the current date

                        var da = moment(results.date_start);// the date .format();

                        time.set('year',da.get('year'))
                        time.set('month',da.get('month'))
                        time.set('date',da.get('date'))


                        addValue(time.format(),'instant',time.format(),true);

                        break;
                    case 'code' :
                        addValue(results.code,'Code',results.code,true);
                        break;
                    case 'Coding' :
                        var coding = results.coding;
                        addValue(coding,'Coding',"",false);
                        break;
                    case 'CodeableConcept' :

                        var cc = results.cc;
                        var ccText = results.ccText;
                        //if represented as a set of radio buttons, then the response is a json string not an object
                        if (cc && angular.isString(cc)) {
                            try {
                                cc = JSON.parse(cc);
                            } catch (ex) {
                                alert('There was an error saving the CodeableConcept. Likely the response from theTerminology' +
                                    'server was not understood. The data is NOT saved. Sorry about that')
                                return;
                            }

                        }

                        //todo - the expansion is returning an extension with more info - may be useful later...
                        if (cc && cc.extension) {
                            delete cc.extension;
                        }

                        var newCC;      //this will be the cc that we are saving...


                     //   cc=null; //<<<< just to se if this works...

                        //if the user has selected a cc from the terminology, then use that
                        if (cc) {
                            //var ccText = cc.display;
                            newCC = {coding:[cc]};

                        } else {
                            newCC = {};
                            //now check to see if the user has entered a code directly...
                            if (results.ccDirectSystem && results.ccDirectCode) {
                                newCC.coding = [];
                                newCC.coding.push({system:results.ccDirectSystem,
                                    code:results.ccDirectCode,display:results.ccDirectDisplay})
                            }

                        }

                        if (!ccText) {  //the user didn't enter any text...
                            if (newCC.coding) {     //but they did select an option...
                                ccText = newCC.coding[0].display;
                            } else {
                                //WTF - no selection or text???
                                return;
                            }

                        }

                        newCC.text = ccText;
                        addValue(newCC,'CodeableConcept',ccText,false);
                        break;
                    case 'Reference' :
                        if (results.resourceItem) {
                            //a real resource was selected
                            var selectedResource = results.resourceItem.resource;

                            var v = {reference: selectedResource.resourceType + "/" + selectedResource.id};



                            if (results.resourceItemText) {
                                v.display = results.resourceItemText;
                            } else {
                                v.display = ResourceUtilsSvc.getOneLineSummaryOfResource(selectedResource);
                            }


                            var referenceDisplay = "";
                            if (selectedResource.text) {
                                referenceDisplay = selectedResource.text.div
                            }


                            addValue(v,'Reference',referenceDisplay,false);
                        } else {
                            //no resource selected - was there any text?
                            if (results.resourceItemText) {
                                var v = {display: results.resourceItemText};
                                addValue(v,'Reference',results.resourceItemText);
                            }

                        }
                        break;
                    case 'Identifier' :
                        var v = {'system': results.identifier_system,value:results.identifier_value};
                        addValue(v,'Identifier',results.identifier_value,false);
                        break;
                    case 'Period' :

                        var daStart = moment(results.date_start).format('YYYY-MM-DD');
                        var daEnd = moment(results.date_end).format('YYYY-MM-DD');


                        var display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                        display += ' to '+ moment(results.date_end).format('YYYY-MM-DD');
                        var v = {start: daStart,end: daEnd};

                        if (results.period.startOnly) {
                            display = 'From'+ moment(results.date_start).format('YYYY-MM-DD');
                            v = {start: daStart};
                        }


                        addValue(v,'Period',display,false);
                        break;
                    case 'Age' :


                        //this is being set as a JSON string rather than an object - I'm not sure why...
                        var units = JSON.parse(results.ageunits);
                        var v = {value: results.age.value,
                            units: units.display,
                            system:'http://ucum.org',
                            code:units.code};



                        addValue(v,'Age',results.age.value + " "+units.display,true);
                        break;
                    case 'boolean' :
                        var v = results.boolean;
                        addValue(v,'Boolean',v ? 'Yes' : 'No',true)
                        break;

                }

                return fragment;


            //set the return value. Copied from the original - hence the (currently) unused elements
            function addValue(v,dataType,text,isPrimitive) {


                fragment = {value:v,text:text};

            }



        },
        getRootED : function(path) {
          //return the elementdefinition for the root element of the profile - always the first one...

            if (this.currentProfile && this.currentProfile.snapshot && this.currentProfile.snapshot.element) {

                var rootElement = this.currentProfile.snapshot.element[0];
                rootElement.myData = {sortOrder:-3};
                return rootElement;
            }


        },
        getEDForPath : function(path) {
            var edList = [];
            this.currentProfile.snapshot.element.forEach(function(ed){
                if (ed.path == path) {
                    edList.push(ed)
                }
            })
            return edList;

        },
        getPossibleChildNodes : function(ed,treeData){

            //given an element definition, return a collection of the possible child nodes at that path. Needs to be a promise as
            //it may need to resolve references to extension definitions...
            //also pass in the current treedata which represents the data captured thus far

            var deferred = $q.defer();

            if (!this.currentProfile || !this.currentProfile.snapshot || ! this.currentProfile.snapshot.element) {
                alert("This profile is not valid! It is either missing altogether, or doesn't have a valid snapshot element")
                deferred.reject();
                return deferred.promise;
            }

            //create a hash indexed by path. We'll use this to find extensions of a given element...
            var elementHash = {};
            angular.forEach(this.currentProfile.snapshot.element,function(elementDef) {
                var elPath = elementDef.path;
                if (! elementHash[elPath]) {
                    elementHash[elPath] = [];
                }
                elementHash[elPath].push(elementDef);

            });

            var sortOrder = 0;  //this wil be the order when the resource is built...
            
            //create a hash indexed by path. we'll use that to determine if a given child path is available (ie can be more than one)
            var dataHash = {};
            treeData.forEach(function(item){
                var path = item.ed.path;
                dataHash[path] = dataHash[path] || {max : item.ed.max,values : []};      //there can be multiple values at a given path
                dataHash[path].values.push({item:item})
                //dataHash[path].display = item.myData.display;   //used when looking for existing extensions...
            });

            //console.log(dataHash);


            var that = this;
            //these are nodes whose path has one more '.' - eg if ed.path = Condition.stage, then Condition.stage.summary is included
            var exclusions=['id','meta','implicitRules','language','text','contained','modifierExtension'];
            var children = [];      //the array of potential child nodes...
            var queries = [];         //a list of async queries required to resolve extensions...
            var path = ed.path;     //the path of this ed. child nodes will have this as a parent, and one more dot in the path
            var pathLength = path.length;
            var dotCount = (path.split('.').length);
            angular.forEach(this.currentProfile.snapshot.element,function(elementDef){
                var elPath = elementDef.path;
                var ar = elPath.split('.');

                //console.log(path,elPath,ar.length,dotCount)

                if (elPath.substr(0,pathLength) == path && ar.length == dotCount+1) {
                    //this is an element that is a direct child of the node being examined...
                    var propertyName = ar[dotCount];  //the name of the property in the resource


                    //if this is an extension, then need to see if there is a profile in the type. If it is, then
                    //this is an extension attached to the profile so needs to be rendered...
                    //todo need to think about modifierExtensions
                    if (propertyName == 'extension') {
                        //if there is a profile against the type, it points to the defintion of the extension. Only include it if it does...

                        //so this is a direct extension. have we already processed this node?
                        if (elementDef.myData && elementDef.myData.isExtension) {
                            //if we have already processed it, then we should check to see if there's already a value where max=1
                            //we can't use path ('cause that will always be 'extension') so we'll look on url + display
                            if ( ! canAddChild(elementDef.path,dataHash,elementDef.myData.extensionDefUrl)){
                                elementDef.myData.canAddChild = false;
                                elementDef.myData.displayClass += " noAdd"
                            } else {
                                elementDef.myData.canAddChild = true;
                                elementDef.myData.displayClass = elementDef.myData.displayClass.replace(" noAdd","")
                            }
                            elementDef.myData.sortOrder = sortOrder++;
                            children.push(elementDef);
                        } else {
                            //nope. not processed. see if there is a profile (SD) we can load to figure out the datatype...
//console.log(elementDef)

                            if (elementDef.type && elementDef.type[0].profile ) {
                                //so we need to retrieve the definition of the profile, and update the list of elements.
                                //this will be an asynchronous operation, so add it to the list......

                                var displayName = elementDef.name;

                                elementDef.myData = {canAddChild:true,display:displayName,displayClass:"elementExtension"};
                                if (elementDef.min !== 0) {
                                    elementDef.myData.displayClass += 'elementRequired ';
                                }

                                //get the first one (we know it is populated..)
                                var profileUrl = elementDef.type[0].profile[0];     //the Url of the profile


                                updateFromProfileDefinition(queries, elementDef,profileUrl);    //will add to the list of async queries...



                                elementDef.myData.sortOrder = sortOrder++;
                                children.push(elementDef);

                            }

                        }

                    } else {
                        //this is not an extension - don't include the standard components...
                        if (exclusions.indexOf(propertyName) == -1) {
                            elementDef.myData = {canAddChild:true,display:propertyName,displayClass:""};
                            if (elementDef.min !== 0) {
                                elementDef.myData.displayClass += 'elementRequired ';
                            }

                            if (elementDef.type && elementDef.type[0].code == 'BackboneElement') {
                                elementDef.myData.displayClass += "backboneElement";
                            }

                            //check the max value - forge leaves these elements in the snapshot...

                            if (elementDef.max != '0') {
                                //check to see if a child is permissable - add it if so...

                                if ( ! canAddChild(elementDef.path,dataHash)){
                                    elementDef.myData.canAddChild = false;
                                    elementDef.myData.displayClass += " noAdd"
                                }

                                elementDef.myData.sortOrder = sortOrder++;
                                children.push(elementDef);

                                //OK - so this element is to be included - does it have an extension?
                                //note that we won't look for backbone element extensios here - they'll come up as children when that element is selected...


                                var extensionPath = elPath + '.extension';
                                if (elementHash[extensionPath] && !isBBE(elementDef)) {

                                    //yes there is an extension, now find the elementDef that has the profile that has the extension definition

                                    for (var i=0; i< elementHash[extensionPath].length;i++) {
                                        var el = elementHash[extensionPath][i];
                                        if (el.type) {
                                            el.type.forEach(function (typ) {
                                                if (typ.profile) {
                                                    //so make up an elementDef to represent this extension and add it to the list...
                                                    var urlExt = typ.profile[0];
                                                    var extensionED = {min:el.min,max:el.max,path:extensionPath,myData:{}};   //todo -fix cardinality..
                                                    extensionED.name = el.name;
                                                    extensionED.myData.canAddChild = true;
                                                    extensionED.myData.displayClass = 'elementExtension';

                                                    //extendedElement is used by the resource builder to add the extension to this element - not the branch extensions array
                                                    extensionED.myData.extendedElement = {path:elPath,parentED:elementDef}
                                                    extensionED.myData.extendedElement.parentName = ar[ar.length-1];  //the name of the element being extended


                                                    //we need to know if the parent (this element) is simple of complex, as the extension structure is different...
                                                    var complexDataType = false;
                                                    var fl = elementDef.type[0].code.charAt(0);     //pretty sure this must always be present...
                                                    if (fl == fl.toUpperCase()) {
                                                        complexDataType = true;
                                                    }
                                                    extensionED.myData.extendedElement.isComplex = complexDataType;    //todo - look this up based on the datatype...


                                                    //is the parent of this extension (the element we're currently evaluation) multiple?
                                                    //used by the builder when processing an extension with no parent...
                                                    extensionED.myData.extendedElement.isParentMultiple = that.canRepeat(elementDef);;//false;        //todo find out from the parent ED

                                                    extensionED.myData.display=' -- '+ el.name;
                                                    extensionED.myData.sortOrder = sortOrder++;
                                                    children.push(extensionED);

                                                    //gets the datatype & possibly other stuff...
                                                    updateFromProfileDefinition(queries, extensionED,urlExt)

                                                }
                                            })
                                        }
                                    }


                                }


                            }

                        }
                    }

                }





            });

            //Are there any extensions that need to be resolved?
            if (queries.length > 0) {
                //yes - execute all the queries and resolve when all have been completed...
                $q.all(queries).then(
                    function() {
                        deferred.resolve(children);
                    },
                    function(err){
                        alert("error getting SD's for children "+angular.toJson(err))
                    }
                )

            } else {
                //no - we can return the list immediately...
                deferred.resolve(children)

            }

            return deferred.promise;

            //returns true if a child with this path can be added. This is either that the path is multiple, or there is no data at that path yet...
            //if the url is passed in, then we need to check that as well...
            function canAddChild(path,dataHash,url) {
                if ( !dataHash[path] ) {
                    //no data yet, can add
                    return true;
                } else {
                    //there is data - are multiple instances allowed?
                    if (dataHash[path].max == '*') {
                        return true
                    } else {
                        if (url) {
                            //if there's a url, then this is an extension. we need to see if there is already a value with that path & url
                            var pathWithData = dataHash[path];      //this is all the data elements at that path
                            for (var i=0; i<pathWithData.values.length; i++) {
                                var v =  pathWithData.values[i];

                            //pathWithData.values.forEach(function(v){
                                if (v.item && v.item.ed && v.item.ed.myData && v.item.ed.myData.extensionDefUrl == url) {
                                    return false;
                                    break;
                                }
                            }
                            return true;        //nope, this is the first...
                        } else {
                            return false;
                        }

                    }
                }

            }


            function updateFromProfileDefinition(queries, elementDef,url) {
                //update the elementDef from the url (the canonical url, not a direct reference. needs to be async...

                queries.push(GetDataFromServer.findConformanceResourceByUri(url).then(
                    function(sdef) {
                        elementDef.myData.extensionDefinition = sdef;   //save the full definition for later...
                        elementDef.myData.isExtension = true;
                        elementDef.myData.extensionDefUrl = url;      //it's an array (not sure why)

                        //process the definition to get the datatype and url...

                        //analyse the extension definition - eg is it complex or not?
                        var analysis = Utilities.analyseExtensionDefinition(sdef);

                        if (analysis.complexExtension) {
                            //this is a complex extension...
                            elementDef.type = [{code:'Complex'}]
                            elementDef.analysis = analysis;
                        } else {
                            //this is a simple extension


                            if (sdef && sdef.snapshot && sdef.snapshot.element) {
                                sdef.snapshot.element.forEach(function(ed){
                                    var path = ed.path;
                                    if (path.indexOf('.value') > -1) {
                                        elementDef.type = ed.type;  //this is the type from the extension definition

                                    }
                                })
                            }

                        }

                    },
                    function(err) {
                        alert('function: updateFromProfileDefinition - error retrieving '+ url + " "+ angular.toJson(err))
                    }
                ))

            }

            function isBBE(elementDef) {
                //return true if this is a backbone element
                if (elementDef.type && elementDef.type[0].code == 'BackboneElement') {
                    return true
                }
                return false
            }



        },
        canRepeat : function(ed) {
            //whether the element can repeat...
            if (ed) {
                var multiple = true;

                if (ed.base && ed.base.max) {
                    //the base property is used in profiled resources...
                    if (ed.base.max == '1') {
                        multiple = false;
                    }
                } else {
                    //this must be one of the core resource defintions...
                    if (ed.max == '1') {
                        multiple = false
                    }
                }
                return multiple;
            }
            return false;

        },
        buildResource : function(type,treeObject,treeData,config) {
            //create the sample resource...
            //console.log(treeData);
            //console.log(treeObject);
            var resource = {resourceType:type,text:""};
            if (config.profile) {
                resource.meta = resource.meta || {};
                resource.meta.profile = config.profile
            }

            //resource.extension=[]
            //create an object hash of the treeData
            var treeHash = {};
            for (var i=0; i<treeData.length; i++) {
                var node = treeData[i];
                treeHash[node.id] = node;
            }

            var canRepeat = this.canRepeat;     //allows functions in this block to access the canRepeat function outside...



            function addChildrenToNode(resource,node,text) {
                //add the node to the resource. If it has children, then recursively call
                //note that the 'resource' might be better termed a 'branch' as it effectively represents a BackBone element. It's the resource we're building..


                var lnode = treeHash[node.id];

                var path = lnode.path;
                var ar = path.split('.');
                var propertyName = ar[ar.length-1];

                if (propertyName.indexOf('[x]') > -1) {
                    //this is a polymorphic field...

                    //capitilize the first letter - leave the rest as-is        //todo - need proper dt handling - name & primative ? object like resourcetype
                    var dtx = lnode.dataType.code;   //the selected datatype
                    dtx = dtx.charAt(0).toUpperCase() + dtx.substr(1);
                  //  console.log()
                    propertyName = propertyName.slice(0, -3) + dtx;
                   
                }

                //a value of false is valid for boolean - hence the simple check is not enough...
                if (typeof lnode.fragment != 'undefined'&& lnode.fragment != null ) {
                    //if the 'resource' is an array, then there can be multiple elements...

                    //this should never occur..
                    if (angular.isArray(resource)) {
                        alert('array passed  - This is an error, please tell the author of clinFHIR!')
                        //var o = {};
                        //o[propertyName] = lnode.fragment;
                        //resource.push(o)

                    } else {

                        //is this is repeating element?
                        var cr = canRepeat(lnode.ed);

                        if (propertyName == 'extension') {
                            var url = lnode.ed.myData.extensionDefUrl;      //the Url to the profile
                            var dt = 'value'+lnode.dataType.code.capitalize();
                            
                            var extensionFragment = {url:url};
                            extensionFragment[dt] = angular.copy(lnode.fragment);   //we don't want to change the object in the tree view...
/*
                            //now to determine if this is a primitive or complex datatype. The 'case' of the first letter will tell us...
                            var complexDataType = false;
                            var fl = lnode.dataType.code.charAt(0);
                            if (fl == fl.toUpperCase()) {
                                complexDataType = true;
                            }*/
                            
                            var processed = false;
                            //if lnode.ed.myData.extendedElement exists then it's actually an extension on a value within this 'branch'
                            //what we really want to do is to add it to the element - not to the extension array of this branch
                            //the 'extendedElement' value is set by the getPossibleChildNodes function above...
                            if (lnode.ed.myData.extendedElement) {
                                console.log('>> extended element')
                                var parentName = lnode.ed.myData.extendedElement.parentName; //the name of the element in this branch
                                //is there an element of this name on the current branch?

                                //this routine will add the extension to the element if the element being extended has a value...
                                angular.forEach(resource,function(value,key){
                                    console.log(value,key)
                                    if (key ==parentName)  {
                                        console.log('parent found')

                                        if (lnode.ed.myData.extendedElement.isComplex) {
                                            //the parent is a complex datatype
                                            value.extension = value.extension || [];
                                            value.extension.push(extensionFragment);
                                        } else {
                                            //this is a primitive datatype. We actually add a new element to represent the extension
                                            var elementName = '_' + parentName;
                                            resource[elementName] = {extension:[]};
                                            resource[elementName].extension.push(extensionFragment);

                                        }

                                        processed = true;
                                    }
                                });

                                if (! processed) {
                                    //if not processed, then the 'parent' element is not (?yet) present. This is legal in FHIR
                                    //so need to create an 'empty' element to add the extension to.

                                    //first we need to find out if the parent would be a repeating one (CanRepeat)...
                                    var parentCR = lnode.ed.myData.extendedElement.isParentMultiple;
                                    if (parentCR) {
                                        //can repeat
                                        //todo - does a primitive ever repeat? I'm going to assume not, but be prepared to fix here if if can...
                                        resource[parentName] = [];  //parent is an array of properties...
                                        var extToAdd = {extension:[extensionFragment]}


                                        resource[parentName].push({extension:[extensionFragment]});
                                        processed = true;

                                    } else {
                                        //single only

                                        if (lnode.ed.myData.extendedElement.isComplex) {
                                            //resource.extension = resource.extension || [];
                                            //resource.extension.push(extensionFragment);
                                            resource[parentName] = {extension:[]};
                                            resource[parentName].extension.push(extensionFragment);
                                        } else {
                                            var elementName = '_' + parentName;
                                            resource[elementName] = {extension:[]};
                                            resource[elementName].extension.push(extensionFragment);
                                        }


                                        processed = true;
                                    }
                                }
                            }       //marks the end of an extended alement (rather than an extension to the resource root)

                            //the extension may have been added to al element. If not, then add to the main extensions array
                            if (! processed) {
                                resource.extension = resource.extension || [];
                                resource.extension.push(extensionFragment);

                                /* - don't think this is needed...
                                if (lnode.ed.myData.extendedElement) {
                                   //this is still an extenstion to add to an element
                                    if (lnode.ed.myData.extendedElement.isComplex) {
                                        resource.extension = resource.extension || [];
                                        resource.extension.push(extensionFragment);
                                    } else {
                                        var elementName = '_' + parentName;
                                        resource[elementName] = {extension: []};
                                        resource[elementName].extension.push(extensionFragment);
                                    }
                                }
                                */

                            }

                        } else {
                            //this is an 'ordinary' element - not an extension...
                            //if a repeating elment then it is in an array...
                            if (cr) {
                                resource[propertyName] = resource[propertyName] || []
                                resource[propertyName].push(lnode.fragment)
                            } else {
                                resource[propertyName] = lnode.fragment;
                                text.value += lnode.display + ' ';
                            }

                        }


                    }


                }



                //now process any chldren of this node...
                if (node.children && node.children.length > 0) {
                    node.children.forEach(function(child){
                        var childNodeHash = treeHash[child.id];
                        var ed = childNodeHash.ed;      //the element definition describing this element
                        //is this a backbone
                        if (ed && ed.type) {
                            if (ed.type[0].code == 'BackboneElement') {
                                //yes! a backbone element. we need to create a new object to act as the resource
                                var ar1 = ed.path.split('.');
                                var pName = ar1[ar1.length-1];


                                var obj;
                                //is this a repeating node? - ie an array...
                                var cr = canRepeat(ed);
                                obj = {};
                                if (cr) {
                                    //this is a repeating element. Is there already an array for this element?
                                    if (! resource[pName]) {
                                        resource[pName] = [];
                                    }
                                    resource[pName].push(obj);


                                } else {
                                    //this is a singleton...
                                    resource[pName] = obj;
                                }


                                addChildrenToNode(obj,child,text)
                            } else {

                                addChildrenToNode(resource,child,text)
                            }


                        } else {
                            //no, just add to the resource
                            addChildrenToNode(resource,child,text)
                        }



                    })
                }

            }


            var text = {value:""};
            addChildrenToNode(resource,treeObject,text);

            var txt ="<div xmlns='http://www.w3.org/1999/xhtml'><div>"+ResourceUtilsSvc.getOneLineSummaryOfResource(resource)+"</div></div>"

            resource.text = {status:'generated',div:txt};


            return resource;


        },
        addPatientToTree: function(path, patient, treeData) {
            //add the patient reference to the tree  path = path to patient, patient = patient resource, treeData = data for tree

            if (patient) {
                var fragment = {reference:'Patient/'+patient.id,display:ResourceUtilsSvc.getOneLineSummaryOfResource(patient)};
                //path = the path in the resource - relative to the parent
                //fragment = the json to render at that path. If a 'parent' in the resource (node type=BackboneElement) - eg Condition.Stage then the fragment is empty.
                // var patientNode = getElementDefinitionFromPath(path)
                var edList = this.getEDForPath(path);
                var ar = path.split('.');
                var patientPropertyName = ar[1];
                treeData.push({id:'patient',parent:'root',text:patientPropertyName,path:path,ed:edList[0],fragment:fragment});

            }


        },
        setCurrentProfile : function(profile) {
            this.currentProfile = profile;
        },
        getCurrentProfile : function(){
            return this.currentProfile;
        },
        getProfileDEP : function(type){
                var deferred = $q.defer();
                var that=this;

                $http.get("artifacts/"+type+".json").then(
                    function(data) {
                        that.currentProfile = data.data;
                        deferred.resolve(data.data)
                    }
                );
                return deferred.promise;


            },
        dataTypeSelected : function(dt,resourceProfile, results,element,scope,allResources) {
            //todo - get rid of the scope...
            //dt = dataType
            //resourceType - selected resourceType if a resource reference
            //element = elementDefinition 
            //scope = really shouldn't be here
            //allResources = all resources for the current patient...
            
            switch (dt) {

                case 'Period' :
                    results.period = {startOnly:false};
                    break;

                case 'Quantity' :

                    scope.showWaiting = true;
                    //age-units
                    GetDataFromServer.getExpandedValueSet('ucum-common').then(
                        function(vs) {

                            scope.showWaiting = false;
                            scope.ucum = vs.expansion.contains;
                        }, function(err){
                            scope.showWaiting = false;
                            alert("Unable to get the UCUM codes, you can still enter them manually");
                            console.log(err)

                        }
                    );
                    break;


                case 'Identifier' :


                    //see if there is a constraint in identifier system - if so, then set it as a default...
                    if (element.constraint) {
                        var search = 'identifier[system/@value=';
                        element.constraint.forEach(function(con){
                            if (con.xpath && con.xpath.indexOf(search)>-1) {
                                var g = con.xpath.indexOf('=');
                                var system = con.xpath.substr(g+1);
                                system = system.replace(/]/g,"");
                                results.identifier_system = system;
                            }
                        })
                    };


                    break;

                case 'ContactPoint' :
                    results.ct = {use:'home',system:'mobile'};
                    break;

                case 'HumanName' :
                    results.hn = {use:'usual'};
                    break;

                case 'Address' :
                    results.addr = {use:'home'};
                    break;

                case 'Narrative' :
                    //enter extra narrative
                    results.narrative = ""; //todo scope.profile.snapshot.element[0].valueNarrative;
                    break;

                case 'Annotation' :
                    //enter extra narrative
                    results.annotation = {text:'',authorString:''};
                    break;


                case 'Age' :
                    scope.UCUMAgeUnits = Utilities.getUCUMUnits('age');
                    break;

                case 'Money' :
                    scope.UCUMMoneyUnits = Utilities.getUCUMUnits('money');
                    break;

                case 'Reference' :
                    //todo - have a service that creates a full summary of a resource - and a 1 liner for the drop down
                   //todo - right now, we will assume the type being references is a base resource

                    if (! RenderProfileSvc.isUrlaBaseResource(resourceProfile)) {
                        //this is a reference to profile on a base resource. need to load the profile so we can figure out the base type
                        //todo **** not wrking ****
                        alert('Sorry, referencing profiled resources is not yet supported...')
                        return;
                        
                        scope.profileUrlInReference = resourceProfile;  // ??? changes may ct referenceProfile;

                        GetDataFromServer.findConformanceResourceByUri(referenceProfile).then(  //will go to the current conformance server
                            function(profile){
                                var resourceType = profile.constrainedType;//  Utilities.getResourceTypeFromUrl();
                                scope.resourceType = resourceType;
                                scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType) ;//  scope.resourcetypes[resourceType];
                                //todo -this won;t be correct...
                                //-temp- scope.externalReferenceSpecPage = "http://hl7.org/fhir/2015May/" + resourceType + ".html";
                                //todo - need to pass the profilein as welll

                                //if this is a 'reference' type resource (lkike origanization)t then don't
                                //incldue any of thm in the list

                                scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                    allResources,resourceType,profile.url);

                            },
                            function(err) {
                                alert('Unable to retrieve the StructureDefinition for '+referenceProfile)
                            }
                        )


                    } else {
                        //this is a base resource. ..

                        var ar = resourceProfile.split('/');
                        var resourceType = ar[ar.length-1];         //the type name (eg 'Practitioner')
                        
                        //if any resource can be referenced here - ie not a specific type
                        if (resourceType== 'Resource') {
                            //scope.uniqueResources will be a collection of all the resource types for this patient
                            
                            scope.uniqueResources = RenderProfileSvc.getUniqueResources(allResources);
                        } else {
                            delete scope.uniqueResources;
                        }

                        //this defines the resource type - eg whether it is a reference resource rather than linked to a patient...
                        //if the type is 'Resource' then it will be null...
                        scope.selectedReferenceResourceType = RenderProfileSvc.getResourceTypeDefinition(resourceType);

                        //scope.resourceType = resourceType;


                        //if the resource type is one that is a 'reference' - ie doesn't link to a patient then
                        //the resourceList is empty. Otherwise populate it with the existing resources of that type for the patient
                        //todo note that this means that a type of 'Resource' effectively means only existing non-reference resources - needs to be fixed
                        if (! scope.selectedReferenceResourceType || scope.selectedReferenceResourceType.reference) {
                            // if (scope.allResourceTypesIndexedByType[resourceType].reference) {
                           // delete scope.resourceList;
                        } else {
                            //the list of resources of this type linked to this patient that can be selected...
                            scope.resourceList = RenderProfileSvc.getResourcesSelectListOfType(
                                allResources,resourceType);
                        }

                    }

                    break;
                case 'date' :
                    //results.date_start = "";
                    break;
                case 'string' :
                    //results.string = "";
                    break;



                case 'Coding' :
                    //returns the Url of the reference.
                    var valueSetReference = RenderProfileSvc.getUniqueResources(element);

                    results.coding = null;
                    if (valueSetReference) {
                        Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                            function (vsDetails) {

                                scope.vsDetails = vsDetails;
                            });
                        scope.vsReference = valueSetReference.reference;
                    }
                    break;
                case 'CodeableConcept' :
                    scope.vsReference = null;
                    delete scope.valueSet;
                    if (element.binding) {

                        //get the name of the referenced valueset in the profile - eg http://hl7.org/fhir/ValueSet/condition-code
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);

                        //Assuming there is a valueset...
                        if (valueSetReference) {
                            scope.showWaiting = true;
                            results.cc = "";

                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    //if the current registry does have a copy of the valueset, and it's a small one, then render as
                                    //a series of radio buttons.
                                    if (scope.vsDetails && scope.vsDetails.type == 'list') {
                                        //this is a list type - ie a small number, so retrieve the entire list (expanded
                                        //but not filtered) and set the appropriate scope. This will be rendered as a set of
                                        //radio buttons...
                                        scope.showWaiting = true;
                                        // delete scope.valueSet;
                                        //scope.showWaiting = true;
                                        GetDataFromServer.getExpandedValueSet(scope.vsDetails.id).then(   //get the expanded vs
                                            function(data){
                                                //get rid of the '(qualifier value)' that is in some codes...
                                                angular.forEach(data.expansion.contains,function(item){
                                                    if (item.display) {
                                                        item.display = item.display.replace('(qualifier value)',"");
                                                    }

                                                });
                                                scope.valueSet = data;
                                            }).finally(function() {
                                                scope.showWaiting = false;
                                            }
                                        )
                                    } else {
                                        scope.showWaiting = false;
                                    }


                                });

                            scope.vsReference = valueSetReference.reference;




                        }

                    }
                    break;
                case 'code' :
                    delete scope.valueSet;
                    delete scope.vsReference;
                    if (element.binding) {
                        //retrieve the reference to the ValueSet
                        var valueSetReference = RenderProfileSvc.getValueSetReferenceFromBinding(element);



                        if (valueSetReference) {

                            //get the id of the valueset on the registry server
                            Utilities.getValueSetIdFromRegistry(valueSetReference.reference,

                                function(vsDetails){
                                    scope.vsDetails = vsDetails;

                                    if (vsDetails) {
                                        scope.showWaiting = true;
                                        //get the expansion...
                                        GetDataFromServer.getExpandedValueSet(vsDetails.id).then(
                                            function(vs){
                                                //and if the expansion worked, we're in business...
                                                if (vs.expansion) {
                                                    scope.vsExpansion = vs.expansion.contains;
                                                }


                                            }
                                        ).finally(function(){
                                            scope.showWaiting = false;
                                        });
                                    }

                                });


                            scope.vsReference = valueSetReference.reference;

                        }
                    }
                    break;
            }



        },
        cleanResource : function(treeData) {
            //remove all the elements that are of type BackboneElement but have no references to them.
            //these are elements that should be empty in the constructed resource
            var arParents =[];   //this will be all elementid's that are referenced by something
            var newArray = [];      //this will be the cleaned array
            var objId = {'#':'x'}; //all the ID's - the id of '#' is baked in...
            //construct an object of Id's
            treeData.forEach(function(item){
                objId[item.id] = 'x';
            });

            //build up a list of parents. Assume that the item that is the parent will be before the child referencing it...
            treeData.forEach(function(item){
                var parent = item.parent;
                if (arParents.indexOf(parent) == -1){       //not already in the array...
                    if (objId[parent]) {                    //and the parent does actually exist...
                        arParents.push(parent);
                    }
                }
            });



            //now find elements of type bbe

            treeData.forEach(function(item){
                if (item.isBbe){
                    //if (item.type == 'bbe'){
                    var id = item.id;
                    //if the id is not in the parent array, that means that there are no child elements referencing them so don't add
                    if (arParents.indexOf(id) > -1) {
                        newArray.push(item);
                    }
                } else {
                    //if a normal element, then make sure the parent is in the parents array. If not, don't include in the new array. This covers removing a parent
                    var parent = item.parent;
                    if (arParents.indexOf(parent) > -1){
                        newArray.push(item);
                    }
                }

            });


            return newArray;

        },
        parkResource : function(vo) {
            $localStorage.parkedResources = $localStorage.parkedResources || [];
            $localStorage.parkedResources.push(angular.copy(vo));

        },
        getParkedResources : function() {
            if ($localStorage.parkedResources) {
                var patient = appConfigSvc.getCurrentPatient();
                var lst = [];
                $localStorage.parkedResources.forEach(function(park){
                    if (park.patient && patient && park.patient.id == patient.id) {
                        lst.push(park)
                    }
                })
                return lst;


                //return $localStorage.parkedResources;
            } else {
                return []
            }

        },
        removeParkedResource : function(inx) {
            $localStorage.parkedResources.splice(inx,1)
        },
        getConformanceResource :function(baseUrl) {
            var url = baseUrl + "metadata";
            return $http.get(url,{timeout:10000});
        },
        getConformanceResourceFromUrl :function(url) {
           
            return $http.get(url,{timeout:10000});
        },
        executeQuery : function(verb,qry) {
            switch (verb) {
                case 'GET' :
                    return $http.get(qry);
            }
        },
        addToQueryHistory : function(hx) {
            $localStorage.queryHistory = $localStorage.queryHistory || []

            var duplicate = false;
            for (var i=0; i < $localStorage.queryHistory.length; i++) {
                var item = $localStorage.queryHistory[i];
                if (item.verb == hx.verb && item.type == hx.type && item.parameters == hx.parameters && item.id == hx.id) {
                    duplicate = true;
                    break;
                }
            }

            if (! duplicate) {
                $localStorage.queryHistory.push(hx);
            }
            return $localStorage.queryHistory;
        },
        getProfileDisplay : function(url) {
            //return a collection of elements suitable for a profile summary display..
            //the url is a real reference to the profile location (not the SD.url property)
            var deferred = $q.defer();
            var that = this;
            GetDataFromServer.getConformanceResourceByUrl(url).then(
                function(profile) {
                    var lst = profileCreatorSvc.makeProfileDisplayFromProfile(profile).lst;
                    deferred.resolve({lst:lst,profile:profile})
                }, function (err) {
                    //alert(angular.toJson(err));
                    deferred.reject();
                }
            );



            return deferred.promise;
        },
        makeProfileDisplayFromProfileDEP : function(profile) {
            console.log(profile);
            var arDisabled = [];          //this is a list of disabled items...
            var lst = [];           //this will be a list of elements in the profile to show.
            var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained'];
            var dataTypes = ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName'];
            if (profile && profile.snapshot && profile.snapshot.element) {

                profile.snapshot.element.forEach(function (item) {
                    item.myMeta = {};

                    var el = {path: item.path};
                    var path = item.path;

                    //if max is 0, this path - and all children - are disabled in this profile...
                    if (item.max == 0) {
                        arDisabled.push(path)
                    }



                    //now see if this path has been disabled. There will be more elegant ways of doing this
                    var disabled = false;
                    for (var i = 0; i < arDisabled.length; i++) {
                        var d = arDisabled[i];
                        if (path.substr(0, d.length) == d) {
                            disabled = true;
                            break;
                        }
                    }

                    var ar = path.split('.');
                    if (ar.length == 1) {
                        disabled = true;
                    }      //don't include the domain resource

                    //standard element names like 'text' or 'language'
                    if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {
                        disabled = true;
                    }


                    //hide the extension. Will need to figure out how to display 'real' extensions
                    if (ar[ar.length - 1] == 'modifierExtension') {
                        disabled = true;
                    }

                    if (!disabled && ar[ar.length - 1] == 'extension') {
                        disabled = true;    //by default extensions are disabled...
                        //if the extension has a profile type then include it, otherwise not...
                        if (item.type) {
                            item.type.forEach(function (it) {
                                if (it.code == 'Extension' && it.profile) {
                                    disabled = false;
                                    //load the extension definition to

                                    //use the name rather than 'Extension'...
                                    ar[ar.length - 1] = "*"+ item.name;
                                }
                            })
                        }
                    }

                    ar.shift();     //removes the type name at the beginning of the path

                    item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)

                    //make references look nicer. todo - what about references to profiles?
                    /* - temp for now....
                    if (item.type) {
                        item.type.forEach(function (it) {
                            if (it.code == 'Reference') {
                                if (it.profile) {
                                    var p = it.profile[0];      //todo  <<<<<<<<<<<<<<<<<<
                                    var ar = p.split('/');
                                    it.code = '->' + ar[ar.length - 1];
                                }
                            }
                        })
                    }

                    */


                    if (!disabled) {
                        lst.push(item);
                    }


                    //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                    //note that this check is after it has been added to the list...
                    if (item.type) {
                        item.type.forEach(function (type) {
                            if (dataTypes.indexOf(type.code) > -1) {
                                arDisabled.push(path)
                            }
                        });
                    }


                });

            }

            return lst;

        },
        makeProfileDisplayFromProfileALSODEP : function(inProfile) {
            var deferred = $q.defer();
            var lstTree = [];

            var profile = angular.copy(inProfile);      //w emuck around a bit with the profile, so use a copy
            //console.log(profile);
            var arIsDataType = [];          //this is a list of disabled items...
            var lst = [];           //this will be a list of elements in the profile to show.
            var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained'];
            var dataTypes = ['CodeableConcept', 'Identifier', 'Period', 'Quantity', 'Reference','HumanName'];

            var cntExtension = 0;
            //a hash of the id's in the tree. used to ensure we don't add an element to a non-esixtant parent.
            //this occurs when the parent has a max of 0, but child nodes don't
            var idsInTree = {};
            var hashTree = {};
            var queries = [];       //a list of queries to get the details of extensions...
            if (profile && profile.snapshot && profile.snapshot.element) {

                profile.snapshot.element.forEach(function (item) {
                    item.myMeta = item.myMeta || {};

                    var include = true;
                    var el = {path: item.path};

                    var path = item.path;

                    if (! path) {
                        alert('empty path in Element Definition\n'+angular.toJson(item))
                        return;
                    }

                    var ar = path.split('.');

                    //process extensions first as this can set the include true or false - all the others only se false
                    //process an extension. if it has a profile, then display it with a nicer name.
                    if (ar[ar.length - 1] == 'extension') {
                       // disabled = true;    //by default extensions are disabled...
                        //if the extension has a profile type then include it, otherwise not...
                        include = false;

                        if (item.type) {
                            item.type.forEach(function (it) {
                                if (it.code == 'Extension' && it.profile) {
                                   // disabled = false;
                                    include=true;
                                    //load the extension definition
                                    queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                        function(sdef) {
                                            var analysis = Utilities.analyseExtensionDefinition2(sdef);
                                            item.myMeta.analysis = analysis;
                                            console.log(analysis)
                                        }
                                    ));

                                    //use the name rather than 'Extension'...
                                    ar[ar.length - 1] = "*"+ item.name;
                                }
                            })
                        }
                    }

                    //todo hide the modifier extension. Will need to figure out how to display 'real' extensions
                    if (ar[ar.length - 1] == 'modifierExtension') {
                        //disabled = true;
                        include = false;
                    }

                    if (ar.length == 1) {
                        //this is the root node
                        //note - added data friday pm montreal
                        lstTree.push({id:ar[0],parent:'#',text:ar[0],state:{opened:true,selected:true},path:path,data: {ed : item}});
                        idsInTree[ar[0]] = 'x'
                        include = false;
                    }

                    //obviously if the max is 0 then don't show  (might waant an option later to show
                    if (item.max == 0) {
                        include = false;
                    }



                    //standard element names like 'text' or 'language'
                    if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {

                        include = false;
                    }

                    //don't include id elements...
                    if (ar[ar.length-1] == 'id') {
                        include = false;
                    }


                    //don't include removed elements
                    if (item.myMeta.remove) {
                        include = false;
                    }




                    ar.shift();     //removes the type name at the beginning of the path
                    item.myMeta.path = ar.join('. ');     //create a path that doesn't include the type (so is shorter)

                    //make references look nicer.
                    if (item.type) {
                        item.type.forEach(function (it) {

                            console.log(it.code)
                            //a node that has child nodes
                            if (it.code == 'BackboneElement') {
                                item.myMeta.isParent = true;
                            }

                            if (it.code == 'Extension') {
                                item.myMeta.isExtension = true;
                            }

                            if (it.code == 'Reference') {
                                item.myMeta.isReference = true;
                                /*
                                if (it.profile) {
                                    var p = it.profile[0];      //todo  <<<<<<<<<<<<<<<<<<
                                    var ar = p.split('/');
                                    it.code = '->' + ar[ar.length - 1];
                                }
                                */

                            }

                            //if the datatype starts with an uppercase letter, then it's a complex one...
                            if (/[A-Z]/.test( it.code[0])){
                                item.myMeta.isComplex = true;
                            }

                        })
                    }




                    //console.log(path,disabled)

                    //add to tree only if include is still true...
                    if (include) {
                        var id = path;
                        var arText = path.split('.');
                        var text = arText[arText.length-1];

                        var arTree = path.split('.');
                        if (arTree[arTree.length-1] == 'extension') {
                            text = item.name;
                            id = id + cntExtension;
                            cntExtension++;
                        }

                        arTree.pop();
                        var parent = arTree.join('.');

                        var dataType = '';
                        if (item.type) {
                            item.type.forEach(function (it){
                                dataType += " " + it.code;
                            })
                        }

                        var node = {id:id,parent:parent,text:text,state:{opened:false,selected:false},
                            a_attr:{style:'color:green'}, path:path};

//title: dataType,


                        node.data = {ed : item};

                       // if (item.myMeta.isExtension) {
                           // node.a_attr.style='color:red'
                      //  }

                        //set the icon to display. todo Would be better to use a class, but can't get that to work...
                        if (!item.myMeta.isParent) {
                            //if it's not a parent node, then set to a data type...
                            if (item.myMeta.isComplex) {
                                node.icon='/icons/icon_datatype.gif';
                            } else {
                                node.icon='/icons/icon_primitive.png';
                            }


                            if (item.myMeta.isReference) {
                                node.icon='/icons/icon_reference.png';
                            }



                        }

                        if (item.myMeta.isExtension) {
                            node.icon='/icons/icon_extension_simple.png';
                        }




                        //so long as the parent is in the tree, it's safe to add...
                        if (idsInTree[parent]) {
                            lstTree.push(node);
                            idsInTree[id] = 'x'
                            lst.push(item);
                        }

                    }


                    //if the type is a recognized datatype, then hide all child nodes todo - won't show profiled datatyoes
                    //note that this check is after it has been added to the list...

                    if (item.type) {
                        item.type.forEach(function (type) {
                            if (dataTypes.indexOf(type.code) > -1) {
                                arIsDataType.push(path)
                            }
                        });
                    }




                });

            }


            if (queries.length) {
                $q.all(queries).then(
                    function() {


                        //here is where we set the icons - ie after all the extension definitions have been loaded & resolved...



                        deferred.resolve({table:lst,treeData:lstTree})
                    }
                )

            } else {
                deferred.resolve({table:lst,treeData:lstTree})
            }



            return deferred.promise;

           // return {table:lst,treeData:lstTree};

        },
        createConformanceQualityReport : function(conf){
            //create a quality report (list of issues) for a conformance resource
            var lstIssue = [];
            var deferred = $q.defer();
            //console.log(conf)

            var arQueryProfiles = []; //a list of queries - ie referenced profiles
            var arProfiles = [];    //a list of the profiles that have been retrieved...
            var arExtensions = [];      //a list of all the extensions references by profiles in the conformance resource
            var arQueryExtensions = [];  //queries to check the existance of all extension definitions...
            conf.rest[0].resource.forEach(function(res){
                //console.log(res);
                if (!res.profile) {
                    lstIssue.push({level:"warning",display:"The "+res.type + ' type does not have a profile element'})
                } else {
                    var profileUrl = res.profile.reference;
                    if (!profileUrl) {
                        lstIssue.push({level:"warning",display:"The "+res.type + ' type has a profile element, but no reference'})
                    } else {
                        //now check that the reference exists
                        arQueryProfiles.push(getProfile(res,profileUrl));
                    }
                }
            });



            function getExtension(res,extensionUrl){
                //function to load an extension and save it in an array
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(extensionUrl).then(
                    function(extensionDefinition){
                        arExtensions.push({url:extensionUrl,ed:extensionDefinition});    //this the uri for an extension
                    },
                    function(err){
                        lstIssue.push({level:"error",display:"The "+res.type + ' type has a reference to an extension of '+extensionUrl + " which can't be loaded"})
                    }
                ).finally(function(){
                    deferred.resolve();
                });
                return deferred.promise;
            }

            //function to load a profile, then save it in an array. Also generate a list of the extensions and valuesets referenced by that profile
            function getProfile(res,profileUrl) {
                var deferred = $q.defer();
                GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                    function(profile) {
                        arProfiles.push(profile);
                        //now find all extensions referred by the profile
                        if (profile && profile.snapshot) {
                            profile.snapshot.element.forEach(function(element){
                                if (element.path.indexOf('extension')){
                                    if (element.type) {
                                        element.type.forEach(function (it) {
                                            if (it.code == 'Extension' && it.profile) {
                                                it.profile.forEach(function(uri){
                                                   // arExtensions.push({url:uri});    //this the uri for an extension
                                                    arQueryExtensions.push(getExtension(res,uri));      //a function that will check that an extension exists

                                                })

                                            }
                                        })
                                    }
                                }

                            })
                        }


                    },
                    function(err) {
                        lstIssue.push({level:"error",display:"The "+res.type + ' type has a profile reference of '+profileUrl + " which can't be loaded"})
                    }
                ).finally(function(){
                    deferred.resolve();
                });
                return deferred.promise;
            }

            //retrieve all the referenced profiles. Mark an error if one can't be found.
            //for each profile returned, look for extensions and valuesets - we'll check those as well...
            $q.all(arQueryProfiles).then(
                //regardless of success or failure, turn off the saving flag
                function() {
                    //console.log('profiles',arProfiles);     //this will be a collection of all profiles
                    //console.log(lstIssue)

                    //so we've checked all the references from conformance -> profile, now to check the extensions
                    arQueryExtensions
                    $q.all(arQueryProfiles).then(
                        function(){
                            deferred.resolve({issues:lstIssue,profiles:arProfiles,extensions:arExtensions});
                        },
                        function(err) {
                            console.log('error in $q.all reading extensions...')
                        }
                    )



                },
                function(err) {
                    console.log('error in $q.all reading profiles...')
                }
            );



            return deferred.promise;
            
        },
        createProfileTreeDisplay : function(profile,showRemoved){
            //create a clone of the profile suitable for display...
            var simpleDT = ['string','instant','time','date','dateTime','decimal','boolean','integer','base6Binary','uri','unsignedInt','positiveInt','code','id','oid','markdown'];


            var that = this;
            //var slicedExtensions = {};
            var displayProfile = [];

            if (profile && profile.snapshot && profile.snapshot.element) {

                profile.snapshot.element.forEach(function (element) {
                    //var display = {type:[],name:element.name};
                    var display = angular.copy(element);
                    display.myStuff = {};
                    //display.path =  element.path;//.replace(/\./g, ". ")
                    var path = element.path;
                    var ar = path.split('.');
                    display.myStuff.name = display.name;
                    if (!display.myStuff.name) {
                        display.myStuff.name = ar[ar.length - 1]
                    }

                    //add a space to any dots to allow the display to break...  (QIcode medication )
                    display.myStuff.name = display.myStuff.name.replace(/\./g, " \.");

                    if (display.myStuff.name == 'extension' && element.short) {
                        display.myStuff.name = element.short;
                    }

                    if (display.myStuff.name.length > 50) {
                        display.myStuff.name = display.myStuff.name.substr(0, 47) + '...';
                    }

                    if (element.max == '*') {
                        display.myStuff.multiplicity = '*'
                    } else {
                        display.myStuff.multiplicity = ' '
                    }

                    //display.myStuff.multiplicity = element.min + '..' + element.max;


                    //set the indenting...
                    var spacer = "";
                    for (var i = 0; i < ar.length; i++) {
                        spacer += "&nbsp;&nbsp;&nbsp;&nbsp;";
                    }

                    display.myStuff.spacer = $sce.trustAsHtml(spacer);


                    var include = true;         //default is to include an element

                    //generate the discriminators based on path...

                    if (ar[ar.length - 1].indexOf('xtension') > -1) {
                        display.myStuff.isExtension = true;
                        //   if (! slicedExtensions[path]) {
                        //     slicedExtensions[path] = [];
                        //   }
                        //if it has a type with an extension, then add the element to the list of sliced elements. Assume url as the discriminator...
                        if (element.type) {
                            element.type.forEach(function (typ) {
                                //console.log(typ )

                                if (typ.profile) {
                                    //only use the first profilefor now
                                    //var profile = typ.profile[0].replace("http://hl7.org/fhir/StructureDefinition/","");
                                    var profileUrl = typ.profile[0];

                                    //console.log(profileUrl)
                                    //process Extension
                                    GetDataFromServer.findConformanceResourceByUri(profileUrl).then(
                                        //GetDataFromServer.findResourceByUrlPromise('StructureDefinition', profileUrl).then(
                                        function (data) {
                                            var analysis = Utilities.analyseExtensionDefinition(data);
                                            //console.log(analysis)
                                            if (analysis.isCoded) {
                                                display.myStuff.isCoded = true;
                                            }
                                            display.myStuff.extensionAnalysis = analysis;

                                            //if there's a referenceTypes property then this extension references another...
                                            if (analysis.referenceTypes) {
                                                //this is for the summary display...
                                                display.myStuff.dataTypeIcon = "icon_reference.png";
                                                display.myStuff.dataTypeDescription = "This is reference to another resource";
                                                //and this for the detail....
                                                display.myStuff.isReference = true;


                                            }


                                        },
                                        function (err) {
                                            console.log('error getting SD', err)
                                        }
                                    );


                                    //  slicedExtensions[path].push(profile);
                                    display.myStuff.notePoint = path + profileUrl;
                                    display.myStuff.notePoint = display.myStuff.notePoint.replace(/\./g, "_");

                                } else {
                                    //don't include if there is no profile to the extension
                                    include = false;
                                }


                                display.type.push(typ)
                            });
                        } else {
                            //don't include if no type...
                            include = false;

                        }
                    } else {
                        //for non extensions, the point that notes can be attached is the path...
                        display.myStuff.notePoint = path.replace(/\./g, "_");
                    }

                    //look for fixed values. is there a property that starts with 'fixed'?
                    angular.forEach(element, function (value, key) {    //iterate through all the properties...
                        if (key.substr(0, 5) == 'fixed') {
                            //console.log(key,value)
                            display.myStuff.fixed = value;
                            display.myStuff.fixedType = key;
                        }

                    });

                    //look for coded values - is there a binding element
                    if (element.binding) {
                        display.myStuff.isCoded = true;
                    }

                    //get the permissable types
                    if (element.type) {
                        display.myStuff.type = "";
                        element.type.forEach(function (typ) {
                            display.myStuff.type += ', ' + typ.code
                        });

                        display.myStuff.type = display.myStuff.type.substr(2);

                        //create a datatype icon based on the first element in the type
                        display.myStuff.dataTypeIcon = "icon_datatype.gif";
                        display.myStuff.dataTypeDescription = "This is a complex datatype";
                        var code = element.type[0].code;
                        if (simpleDT.indexOf(code) > -1) {
                            display.myStuff.dataTypeIcon = "icon_primitive.png";
                            display.myStuff.dataTypeDescription = "This is a primitive datatype"
                        } else if (code == 'Extension') {
                            //display.myStuff.dataTypeIcon= "icon_extension_simple.png";
                            //display.myStuff.dataTypeDescription = "This was added by an extension"
                            display.myStuff.isSimpleExtension = true;// "icon_extension_simple.png";


                        } else if (code == 'Reference') {
                            display.myStuff.dataTypeIcon = "icon_reference.png";
                            display.myStuff.dataTypeDescription = "This is reference to another resource";
                            display.myStuff.isReference = true;
                            //now create a display for the references...
                            display.myStuff.references = [] || display.myStuff.references;

                            //create an array of all the resources referenced..
                            element.type.forEach(function (typ) {
                                if (typ.profile) {
                                    typ.profile.forEach(function (url) {
                                        var details = {url: url};
                                        var ar = url.split('/');
                                        details.display = ar[ar.length - 1];
                                        details.specification = "http://hl7.org/fhir/" + details.display;
                                        display.myStuff.references.push(details);
                                    })
                                }


                            });


                        } else if (code == 'BackboneElement') {
                            delete display.myStuff.dataTypeIcon;//= "icon_reference.png";
                        }

                    }


                    //remove the 'standard' path elements...
                    var arIntersection = ar.filter(function (n) {
                        return ['meta', 'id', 'implicitRules', 'text', 'contained', 'language'].indexOf(n) != -1
                    });
                    if (arIntersection.length > 0) {
                        include = false
                    }

                    //if showRemoved is false then don't display elements that are marked as removed (max = '0')
                    if (!showRemoved) {
                        if (element.max == '0') {
                            include = false;
                        }
                    }

                    if (include) {
                        displayProfile.push(display)
                    }

                });
            }

            return displayProfile;
        },
        checkTreeConsistency : function(treeData) {
            //check that the current tree is consistent - ie that all 'parent' references are to valid nodes
            var nodeList = {};
            //assemble a list of all the Ids...
            treeData.forEach(function(item){
                nodeList[item.id] = 'x';
            });

            //now make sure that all the 'parent' references are pointing to a valid parent...
            var isConsistent = true;
            treeData.forEach(function(item){
                var parent = item.parent;
                if (parent && parent !== '#') {
                    if (!nodeList[parent]) {
                        isConsistent = false;
                    }
                }
                
            });
            return isConsistent;
        },
        registerAccess : function(){
            //register access for the logs...
            $http.post('http://clinfhir.com/stats/login',{}).then(
                function(data){
                    //console.log(data);
                },
                function(err){
                    console.log('error accessing clinfhir',err)
                }
            );

        },
        getDataTypesForProfileCreator: function () {
            //return a list of all the possible datatypes
            //right now it is hard coded, but eventually it will be loaded by examining available SDs...

            var lst = [];
            lst.push({code:'string'});
            lst.push({code:'CodeableConcept',isCoded:true});
            lst.push({code:'decimal'});
            lst.push({code:'Quantity'});
            lst.push({code:'date'});
            lst.push({code:'dateTime'});
            lst.push({code:'Period'});
            lst.push({code:'Range'});
            lst.push({code:'Age'});
            lst.push({code:'boolean'});
            lst.push({code:'Reference'});
            lst.push({code:'Identifier'});
            lst.push({code:'uri'});
            lst.push({code:'Ratio'});
            lst.push({code:'Humancode'});
            lst.push({code:'Address'});
            lst.push({code:'ContactPoint'});
            lst.push({code:'code',isCoded:true});
            lst.push({code:'Coding',isCoded:true});
  /*          return lst;
            
            var lst = [];
            lst.push({code:'II',description:'Instance Identifier'});
            lst.push({code:'CS',description:'Coded Simple'});
            lst.push({code:'code',description:'Code'});
            lst.push({code:'CE',description:'Coded with Equivalents'});
            lst.push({code:'ST',description:'String'});
            lst.push({code:'TS',description:'Timestamp'});
            lst.push({code:'INT',description:'Integer'});
            lst.push({code:'AD',description:'Address'});
            lst.push({code:'TEL',description:'Telecom'});
            lst.push({code:'EN',description:'Encapsulated Name'});
            lst.push({code:'ED',description:'Encapsulated Data'});
            lst.push({code:'BL',description:'Boolean'});
            lst.push({code:'IVL_TL',description:'Interval of timestamp'});
            lst.push({code:'SC',description:'Character String with Code'});
*/

            lst.forEach(function(item){
               // item.description = item.description + " ("+ item.code + ")";
                item.description = item.code;

            });


            lst.push({code:'BackboneElement'});

            return lst

        },
        saveNewProfileDEP : function(profileName,model,baseProfile,isEdit) {
            //save the newly created profile. The structure is different for STU 2 & 3. sigh.
            //baseProfile is the profile that is being constrained
            //isEdit is when a profiled resource is being updated (it's not a new one, but an update to the current one
            if (!profileName) {
                alert('The profile name is required');
                return;
            }
            var deferred = $q.defer();
            var config = appConfigSvc.config();
            //model is the array of tree nodes...
            //iterate through the model to build the profile;

            var fhirVersion = 2;
            var svr = appConfigSvc.getServerByUrl(config.servers.conformance);
            if (svr)  {
                fhirVersion = svr.version;
            }

            var sd;         //this is the StructureDefinition for the Profile
            if (fhirVersion == 3) {
                if (! isEdit) {
                    //this is a new profile on a base type...
                    sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                        status:'draft',experimental : true, snapshot : {element:[]}};

                    sd.abstract = false;
                    sd.baseType = baseProfile.name;         //assume that constariing a base resource
                    sd.baseDefinition = baseProfile.url;    //assume that constariing a base resource
                    sd.derivation = 'constraint';
                    sd.id = profileName;
                    var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                    var profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;

                    sd.url = profileUrl;
                } else {
                    //this is an edit. Remove all the existing ED's because we are going to update them...
                    sd = angular.copy(baseProfile);
                    sd.snapshot.element.length = 0;

                }

                //the value of the 'type' property - ie what the base Resource is - changed between stu2 & 3...
                var typeName = 'baseType';
            } else {
                sd = {resourceType:'StructureDefinition',name : profileName, kind:'resource',
                    status:'draft',experimental : true, snapshot : {element:[]}};
                var profileId = profileName;       //todo - ensure not yet used (or this is an update)
                var profileUrl = config.servers.conformance + "StructureDefinition/" +profileId;
                sd.url = profileUrl;

                //the value of the 'type' property - ie what the base Resource is - changed between stu2 & 3...
                var typeName = 'base';
            }

            var log = [];

            var SDsToSave = [];     //this will be an array of extension SD's plus a single profile SD



            //here is where we iterate through the tree model, pulling out the ElementDefinitions and adding them to the profile...

            model.forEach(function(item,index) {
                if (item.data && item.data.ed) {
                    var ed = item.data.ed;

                    //the first entry is always the root, which in this case will have the base type being extended...
                    if (! sd[typeName]) {
                        sd[typeName] = ed.path;
                        //now add the meta element





                    }

                    var inProfile = true;       //true if this ed is to be included in the profile
                    if (ed.myMeta) {
                        if (ed.myMeta.remove) {
                            inProfile = false;
                        } else if (ed.myMeta.isNew) {
                            //this is a new extension. we'll create a new extension for now - later will allow the user to select an existing one
                            //the extension will only have a single datatype (for now)
                            var extensionId = profileName +  ed.path.replace(/\./,'-');     //the  Id for
                            var extensionUrl = config.servers.conformance + "StructureDefinition/" +extensionId;
                            var dt = ed.type[0].code;   //only a single dt per entry (right now)
                            //now change the datatype in the profile to be an extension, with a profile pointing to the ED
                            ed.type[0].code = "Extension";      // 'cause that's what it is...
                            ed.type[0].profile = [extensionUrl];      //and where to find it.
                            //ed.min = 0;
                            //ed.max = '1';

                            //and change the path to be 'Extension'
                            var ar = ed.path.split('.');
                            var extensionDefId = ar[ar.length-1];
                            ar[ar.length-1] = 'extension';
                            ed.path = ar.join('.');
                             var valueName = "Extension.value" + dt.capitalize();    //the value name in the extension definition
                            //console.log(ed);

                            //the extensionDefinition that describes this extension...
                            var extensionSD = {"resourceType": "StructureDefinition","url": extensionUrl,
                                "name": ed.path,"kind": "datatype",
                                "snapshot" : {element:[]}
                            };
//console.log(fhirVersion)
                            //these are STU-3 - not sure about STU-2
                            if (fhirVersion == 3) {
                                extensionSD.abstract = false;
                                extensionSD.baseType = "Extension";
                                extensionSD.baseDefinition = "http://hl7.org/fhir/StructureDefinition/Extension";
                                extensionSD.derivation = 'constraint';
                                extensionSD.id = extensionId;
                                extensionSD.status='draft';
                                extensionSD.contextType = "datatype";
                                extensionSD.context=["Element"];
                            } else {
                                extensionSD.constrainedType = "Extension";
                                extensionSD.base = "http://hl7.org/fhir/StructureDefinition/Extension";
                            }


                            extensionSD.snapshot.element.push({path:'Extension',definition:'ext',min:0,max:'1',type:[{code:'Extension'}]});
                            extensionSD.snapshot.element.push({path:'Extension.url',definition:'Url',min:1,max:'1',type:[{code:'uri'}]});
                            extensionSD.snapshot.element.push({path:valueName,definition:'value',min:0,max:'1',type:[{code:dt}]});

                            SDsToSave.push(saveStructureDefinition(extensionId,extensionSD).then(
                                function() {
                                    log.push('Saved '+extensionSD.url);
                                },function(err){
                                    log.push('Error saving '+extensionSD.url+ ' ' + angular.toJson(err));
                                }
                            ));
                        }
                    }

                    //if this element is tobe included in the profile, we can add it now...
                    if (inProfile) {
                        delete ed.myMeta;
                        sd.snapshot.element.push(ed)
                    }

                    if (index == 0) {
                        //this is the first element - ie the one with the type name. we can add the meta element now...
                        var resourceType = baseProfile.snapshot.element[0].path;
                        var idElement = {definition:'Id',min:0,max:'1',type:[{code:'id'}]};
                        idElement.base = {path:"Resource.id",min:0,max:'1'};
                        idElement.path = resourceType+'.id';

                        sd.snapshot.element.push(idElement)

                        var metaElement = {}
                        metaElement.path = resourceType +'.meta';    //the resource type is always the first emelent
                        metaElement.definition = 'The meta element';
                        metaElement.min=0;
                        metaElement.max='1';
                        metaElement.base = {path:"Resource.meta",min:0,max:'1'}
                        metaElement.type=[{code:'Meta'}];

                        sd.snapshot.element.push(metaElement);

                        var textElement = {definition:'Narrative',min:0,max:'1',type:[{code:'Narrative'}]};
                        textElement.base = {path:"DomainResource.text",min:0,max:'*'};
                        textElement.path = resourceType+'.text';

                        sd.snapshot.element.push(textElement)


                    }



                }

            });

            console.log(sd)
            //now add the profile to the list of SD's to save
            SDsToSave.push(saveStructureDefinition(profileId,sd).then(
                function() {
                    log.push('Saved '+sd.url);
                },function(err){
                    //log.push('Error saving '+sd.url+ ' ' + angular.toJson(err));
                    log.push(err.data);
                }));

            console.log(SDsToSave);

            $q.all(SDsToSave).then(
                function(){
                    deferred.resolve({log:log,profile:sd});
                },function(err) {
                    alert('Error saving profile and/or extension definitions '+ angular.toJson(err))
                    deferred.reject(err);
                }
            );
            

            return deferred.promise;


            function saveStructureDefinition(extensionId,extensionDefinition) {
                console.log(extensionId,extensionDefinition);
                return $http.put(extensionDefinition.url,extensionDefinition)



            }
        },
        getProfileFromConformanceServerById : function(id) {
            //get a profile from the current concormance server based on its id. Used by the profile creator to see if the new profile alreadt exists
            var config = appConfigSvc.config();
            var url = config.servers.conformance + "StructureDefinition/"+id;
            return $http.get(url);
        },
        getLookupForCode : function(system,code) {
            //lookup the current terminology server for the given code and system
            var config = appConfigSvc.config();
            var svr = appConfigSvc.getServerByUrl(config.servers.terminology);
            if (svr)  {
                if (svr.version < 3) {
                    //just don't do the lookupin an earlier version
                   // alert("This functionality is only available in STU-3. Sorry about that");
                    var deferred = $q.defer();
                    deferred.reject('not version 3');
                    return deferred.promise;
                }
            }

            var url = config.servers.terminology + 'CodeSystem/$lookup?code='+code+"&system="+system;
           // return $http.post(url);
            return $http.get(url);
        },
        parseCodeLookupResponse : function(resp) {
            //parse the response from the codeSystem/$lookup operation. For now, assume SNOMED todo - check
            var obj = {parent:[],children:[]}
            resp.parameter.forEach(function(param){
                switch (param.name) {
                    case 'name' :
                        obj.name = param.valueString;
                        break;
                    case 'display' :
                        obj.display = param.valueString;
                        break;

                    case 'parent' :
                        console.log(param)
                        var code, value, description;
                        param.part.forEach(function(part){

                            if (part.name == 'code') {
                                code = part.valueString;
                            } else if (part.name == 'display') {
                                description = part.valueString;
                            }
                        })

                        obj.parent.push({value:code,description:description});
                        break;

                    case 'child' :      //ontoserver does this
                        var code, value, description;
                        param.part.forEach(function(part){

                            if (part.name == 'code') {
                                code = part.valueString;
                            } else if (part.name == 'display') {
                                description = part.valueString;
                            }
                        })
                        obj.children.push({value:code,description:description});
                        break;

                    case 'property' :
                        var code, value, description;
                        param.part.forEach(function(part){

                            if (part.name == 'code') {
                                code = part.valueString;
                            } else if (part.name == 'value') {
                                value = part.valueString;
                            } else if (part.name == 'description') {
                                description = part.valueString;
                            }
                        })
                        //now see what we've got in this parameter...

                        switch (code) {
                            case 'parent' :
                                obj.parent.push({value:value,description:description});
                                break;
                            case 'child' :
                                obj.children.push({value:value,description:description});
                                break;
                        }



                        break;
                    default :
                        console.log('unrecognised param',param)
                }

            })
            return obj;
        },
        checkExtensionDefinitionsAreOnServer : function(serverUrl,arExtensions) {
            //retrieve all the StructureDefinitions that describe the extensions in this resource
            var queries = [];
            var deferred = $q.defer();
            if (arExtensions.length == 0) {
                deferred.resolve(arExtensions);
                return deferred.promise;
            }


            arExtensions.forEach(function(ext){

                queries.push(GetDataFromServer.findConformanceResourceByUri(ext.url,serverUrl).then(
                    function(sdef) {
                        console.log(sdef)
                        delete ext.noSdef;
                        ext.sdef = sdef;

                    },
                    function(err) {
                        ext.noSdef = true;
                        delete ext.sdef;
                        console.log('Error retrieving '+ ext.url + " "+ angular.toJson(err))
                    }
                ))
            });

            $q.all(queries).then(
                function() {
                    deferred.resolve(arExtensions);
                },
                function(err){
                   // alert("error getting SD's for children "+angular.toJson(err))
                    deferred.reject(err);
                }
            );

            return deferred.promise;
        },
        checkValueSetsAreOnServer : function(serverUrl,arValueSets) {
            //retrieve all the ValueSets that are referenced in this profile
            var queries = [];
            var deferred = $q.defer();
            if (arValueSets.length == 0) {
                deferred.resolve(arValueSets);
                return deferred.promise;
            }
            
            arValueSets.forEach(function(item){
                //so the binding can either be a reference (ie directly to the location of the VS) or a Uri (the cannnonical url)

                //only works where there is a reference to the ValueSet
                if (item.binding && item.binding.valueSetReference && item.binding.valueSetReference.reference) {
                    var url = item.binding.valueSetReference.reference;

                    queries.push(GetDataFromServer.findConformanceResourceByUri(url,serverUrl,'ValueSet').then(
                        function(vs) {
                            console.log(vs)
                            delete item.noVs;
                            item.vs = vs


                        },
                        function(err) {
                            item.noVs = true;
                            delete item.vs;
                            console.log('Error retrieving '+ item.url + " "+ angular.toJson(err))
                        }
                    ))
                } else {
                    item.noVsReference=true;
                }




            });

            $q.all(queries).then(
                function() {
                    deferred.resolve(arValueSets);
                },
                function(err){
                    // alert("error getting SD's for children "+angular.toJson(err))
                    deferred.reject(err);
                }
            );

            return deferred.promise;
        },
        copyConformanceResource : function(uriToCopy,sourceUrl, targetUrl) {
            //copy a conformance resource (eg a StructureDefinition or Value set from a source to a target).
            //If the resource already exists on the target (based on the canonical url) then update it, otherwise create it...

            console.log(uriToCopy,sourceUrl, targetUrl)

            var deferred = $q.defer();

            //first, get the resource to be copied...
            GetDataFromServer.findConformanceResourceByUri(uriToCopy,sourceUrl).then(
                function(resource) {
                    //the resource has been loaded from the source server
                    console.log(resource)
                    //var reasourceId = resource.id;
                    delete resource.id;
                    delete resource.meta;


                    //Now see if the profile already exists. If it does we'll PUT, otherwise POST
                    GetDataFromServer.findConformanceResourceByUri(uriToCopy,targetUrl).then(
                        function(oldResource){
                            //the resource exists - it needs to be updated
                            console.log(oldResource)
                            var resourceId = oldResource.id;
                            var url = targetUrl+ resource.resourceType + '/'+resourceId;
                            $http.put(url,resource).then(
                                function(data){
                                    deferred.resolve('The resource '+ uriToCopy + ' was updated on '+targetUrl+ ' from '+sourceUrl )
                                },function(err) {
                                    deferred.reject('There was an error updating the resource: '+ angular.toJson(err));
                                }
                            )

                        },function(err) {

                            //the resource does not exist - create it.
                            var url = targetUrl+ resource.resourceType;

                            $http.post(url,resource).then(
                                function(data){
                                    deferred.resolve('The resource '+ uriToCopy + ' was created on '+targetUrl+ ' from '+sourceUrl )
                                },function(err) {
                                    deferred.reject('There was an error creating the resource: '+ angular.toJson(err));
                                }
                            )
                        }
                    )




                },
                function(err) {
                    //no resource was found
                    deferred.reject('The resource '+ uriToCopy + ' was not located on the server '+sourceUrl)
                }
            );

            return deferred.promise;


        },
        saveConformanceResource : function() {

        },
        createResourceLabel :function(resource){
            var label;
            switch (resource.resourceType) {
                case 'Observation' :
                    label = 'Observation\n'+ getCCLabel(resource.code);
                    //console.log(label)
                    break;
                case 'Practitioner':
                    label = 'Practitioner\n' + getHumanNameLabel(resource.name[0]);
                    break;

                case 'Encounter' :
                    label = 'Encounter\n' + getDateLabel(resource.period);
                    break;
                case 'Condition' :
                    label = 'Condition\n'+ getCCLabel(resource.code);
                    //console.log(label)
                    break;
                case 'List' :
                    label = resource.title || getCCLabel(resource.code);
                    label = 'List\n'+ label;
                    break;
                case 'Procedure' :
                    label = resource.title || getCCLabel(resource.code);
                    label = 'Procedure\n'+ label;
                    break;
            }


            label = label || resource.resourceType;
            return label;

            function getCCLabel(cc) {
                var label;
                if (cc) {
                    label = cc.text;
                    if (cc.coding) {
                        label = cc.coding[0].display || label

                        if (label && label.length > 20) {
                            label = label.substr(0,17)+'...'
                        }


                    }
                }

                return label;
            }

            function getDateLabel(date) {
                //is this a period with a start?
                if (date && date.start) {
                    return date.start.substr(0,10);   //the date portion only...
                }
            }

            function getHumanNameLabel (hn) {
                var label='';
                if (hn){
                    if (hn.given) {
                        label += hn.given + ' ';
                    }
                    if (hn.family) {
                        label += hn.family + ' ';
                    }

                    if (! label) {
                        label = hn.text;
                    }
                }
                return label;
            }


        },
        createGraphAroundSingleResourceInstance : function(resource,references,graphData) {
            var that = this;

            //we might be addintto an existing graph...
            //todo - id updating, then need to check if the node already exisit b4 adding it below...
            if (! graphData) {graphData = {};}
            graphData.nodes = graphData.nodes || new vis.DataSet([])
            graphData.edges = graphData.edges || new vis.DataSet([])

            var baseId = new Date().getTime();
            var ctr = 0;

            //add the cental resource to the nodes array
            var baseNode = {id:baseId,label:that.createResourceLabel(resource),shape:'box'};

            baseNode.resource =resource;
            if (objColours[resource.resourceType]) {
                baseNode.color = objColours[resource.resourceType];
            }
            baseNode.resource =resource;
            graphData.nodes.add(baseNode);

            //now add the nodes that this one references...
            references.outwardLinks.forEach(function(ref){
                if (ref.resource) {
                    ctr ++;

                    var node = {id:baseId + ctr,label:that.createResourceLabel(ref.resource),shape:'box'} //todo here is where we'll need to find if already added
                    node.resource =ref.resource;
                    if (objColours[ref.resource.resourceType]) {
                        node.color = objColours[ref.resource.resourceType];
                    }
                    graphData.nodes.add(node);  //add the node



                    var link = {from:baseId, to: baseId + ctr, arrows: {to:true}}
                    graphData.edges.add(link);
                }


            });


            //now add the nodes that reference this one...
            references.inwardLinks.forEach(function(ref){
                if (ref.resource) {
                    ctr ++;

                    var node = {id:baseId + ctr,label:that.createResourceLabel(ref.resource),shape:'box'} //todo here is where we'll need to find if already added
                    node.resource =ref.resource;
                    if (objColours[ref.resource.resourceType]) {
                        node.color = objColours[ref.resource.resourceType];
                    }
                    graphData.nodes.add(node);  //add the node
                    
                    var link = {to:baseId, from: baseId + ctr, arrows: {to:true}}
                    graphData.edges.add(link);
                }


            });



            return graphData;

        },
        createGraphOfProfile: function(profile) {
            var deferred = $q.defer();
            var elementsToDisable = ['id', 'meta', 'implicitRules', 'language', 'text', 'contained', 'modifierExtension'];

            var arNodes = [],arEdges=[];
            var objNodes = {};
            profile.snapshot.element.forEach(function(ed,inx){

                var include = true;

                objNodes[ed.path]=inx;
                var ar = ed.path.split('.');

                //exclude the common elements...
               // if (ar.length == 2 && elementsToDisable.indexOf(ar[1]) > -1) {
                  //  include = false;
              //  }

                if (ar.length >1 && elementsToDisable.indexOf(ar[ar.length-1]) > -1) {
                    include = false;
                }


                if (ar[ar.length - 1] == 'extension') {
                    //if the extension has a profile type then include it, otherwise not...
                    include = false;

                    if (ed.type) {
                        ed.type.forEach(function (it) {
                            if (it.code == 'Extension' && it.profile) {
                                include=true;
                                /* may want to do this...
                                //load the extension definition
                                queries.push(GetDataFromServer.findConformanceResourceByUri(it.profile).then(
                                    function(sdef) {
                                        var analysis = Utilities.analyseExtensionDefinition2(sdef);
                                        item.myMeta.analysis = analysis;
                                        //console.log(analysis)
                                    }, function(err) {
                                        alert('Error retrieving '+ t.profile + " "+ angular.toJson(err))
                                    }
                                ));
*/
                                //use the name rather than 'Extension'...
                                ar[ar.length - 1] = ed.name;
                            }
                        })
                    }
                }





                if (include) {
                    var label = ar[0];
                    if (ar.length > 1) {
                        var arLabel = angular.copy(ar);
                        arLabel.shift();
                        label = arLabel.join('.');

                        label = ar[ar.length-1];

                    }
                    //console.log(label)
                    var arParent = angular.copy(ar);
                    arParent.pop();

                    var node = {id:inx,label:label,shape:'box',ed:ed};

                    if (ed.max == '*') {
                        node.label += '*';
                    }

                    if (ed.type) {
                        //var isCoded = false;
                        ed.type.forEach(function(typ){

                            switch (typ.code) {
                                case 'Reference' :
                                    node.shape = 'ellipse';
                                    node.color = {background: 'yellow',border:'black'};
                                    break;
                                case 'BackboneElement' :
                                    node.color = 'lightgreen';
                                    break;
                                case 'DomainResource' :
                                    node.color = 'green';
                                    node.font = {color:'white'};
                                    break;
                            }
                            //now see if this is a coded item....
                            if (['code','Coding','CodeableConcept'].indexOf(typ.code) > -1) {
                                //isCoded = true;
                                node.label += ' C';
                            }

                        })

                    }

                    //an extension...
                    if (ed.path.indexOf('xtension') > -1) {
                        node.color = '#ffccff'
                    }


                    //required...
                    if (ed.min !== 0) {
                        node.font = {color:'red'};
                    }

                   

                    arNodes.push(node);
                    arEdges.push({from:objNodes[arParent.join('.')], to: inx})
                }



            });

            var nodes = new vis.DataSet(arNodes);
            var edges = new vis.DataSet(arEdges);

            // provide the data in the vis format
            var data = {
                nodes: nodes,
                edges: edges
            };

            deferred.resolve(data)
            return deferred.promise;

            //return data;

        },
        createGraphOfInstances : function(allResources) {
            var that=this;
            var deferred = $q.defer();
            //console.log(allResources)


            //create the array for the graph
            var arNodes = [];
            var objNodes = {};


            allResources.forEach(function(resource,inx){
                objNodes[resource.resourceType + "/"+  resource.id] = inx;
                var node = {id:inx,label:that.createResourceLabel(resource),shape:'box'};
                node.resource =resource;
                if (objColours[resource.resourceType]) {
                    node.color = objColours[resource.resourceType];
                }

                //don't include the patient - it completely skews the graph...
                if (resource.resourceType !== 'Patient') {
                    arNodes.push(node)
                }

            });
            
            var nodes = new vis.DataSet(arNodes);

            //now generate the edges for each resource
            var arEdges = [];
            allResources.forEach(function(resource,inx){
                var thisNodeId = objNodes[resource.resourceType + "/"+  resource.id];
                //console.log(thisNodeId)
                var resourceReferences = resourceSvc.getReference(resource);    //get the outward links for this resource
                resourceReferences.outwardLinks.forEach(function(link){
                    var nodeId = objNodes[link.reference];
                    console.log(link)

                    //nodeId will only be set for resources in the 'allReference' object - ie ones we've loaded...
                    if (nodeId) {

                        arEdges.push({from:thisNodeId, to: nodeId, arrows: {to:true},label:link.key})
                    }

                })

                
            })


            var edges = new vis.DataSet(arEdges);

            // provide the data in the vis format
            var data = {
                nodes: nodes,
                edges: edges
            };
            return data;
        },
        createTimeLine : function(allResourcesAsList,conditionsBundle,filterCondition) {
            //create a timeline of encounters
            //if filterCondition is set, then only include encounters on the timeline with that condition as an indication...

            //create the array of conditions. This is used to filter the list
            var objCondition = {};
            if (conditionsBundle && conditionsBundle.entry && conditionsBundle.entry.length > 0) {
                conditionsBundle.entry.forEach(function(entry){
                    var resource = entry.resource;
                    objCondition['Condition/'+resource.id] = {resource:resource,count:0};
                })

            }

            //now create the array of groups. This is the encounter class
            var arGroups = [];
            var objGroups = {};
            allResourcesAsList.forEach(function(resource,inx){
                if (resource.resourceType == 'Encounter') {
                    var klass = resource.class || 'unknown';
                    if (! objGroups[klass]) {
                        var id = arGroups.length+1;
                        arGroups.push({id:id,content:klass});
                        objGroups[klass] = id;
                    }
                }
            });

            //console.log(arGroups)
            //now create the items on the timeline
            var ar = []
            allResourcesAsList.forEach(function(resource,inx){
                if (resource.resourceType == 'Encounter') {
                    if (resource.period && resource.period.start) {

                        //first update the condition count. This is the number of encounters that have this condition as an indication
                        //this is completed regardless of any condition filter

                        //if there is no conditionFilter, then default is to include - otherwise default is not
                        var include = true;
                        if (filterCondition) {include = false;}

                        if (resource.indication) {
                            resource.indication.forEach(function(ind){
                                if (ind.reference && objCondition[ind.reference]) {
                                    objCondition[ind.reference].count++;
                                    if (filterCondition) {
                                        if (ind.reference == filterCondition) {
                                            include = true;
                                        }
                                    }

                                } else {
                                    //generally a procedure...
                                    //console.log('there is a reference to a condition not in the patients list: ' + ind.reference)
                                }
                            })
                        }

                        if (include) {
                            var node = {id:inx,start: resource.period.start,resource:resource};
                            var klass = resource.class || 'unknown';
                            node.group = objGroups[klass];
                            ar.push(node);
                        }

                    }
                }
            });
            
            // Create a DataSet (allows two way data-binding)
            var items = new vis.DataSet(ar);

            return {items:items,groups:new vis.DataSet(arGroups),conditions:objCondition};
            
            
        }
    }

    

});
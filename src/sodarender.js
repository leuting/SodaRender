;(function(){
    var valueoutReg = /\{\{([^\}]*)\}\}/g;

    var getValue = function(data, attrStr){
        var dotIndex = attrStr.indexOf(".");

        if(dotIndex > -1){
            var attr = attrStr.substr(0, dotIndex);
            attrStr = attrStr.substr(dotIndex + 1);

            if(data[attr]){
                return getValue(data[attr], attrStr);
            }else{
                return "";
            }
        }else{
            return data[attrStr] || "";
        }
    };

    // 注释node
    var commentNode = function(node){
    };

    // 标识符
    var IDENTOR_REG = /[a-zA-Z_\$]+[\w\$]*/g;
    var STRING_REG = /"[^"]*"/g
    var NUMBER_REG = /\d+|\d*\.\d+/g;

    var OBJECT_REG = /[a-zA-Z_\$]+[\w\$]*(?:[a-zA-Z_\$]+[\w\$]*|\.|\s)*/g;

    var parseSodaExpression = function(str){
        // 对filter进行处理
        var str = str.split("|");
        var expr = str[0] || "";
        var filters = str.slice(1);

        expr = expr.replace(OBJECT_REG, function(value){
            return "getValue(scope,'" + value.trim() + "')";
        });

        var parseFilter = function(){
            var filterExpr = filters.shift();

            if(! filterExpr){
                return;
            }

            var filterExpr = filterExpr.split(":");
            var args = filterExpr.slice(1) || [];
            var name = filterExpr[0] || "";

            if(sodaFilterMap[name]){
                args.unshift(expr);

                args = args.join(",");

                expr = "sodaFilterMap['" + name + "'](" + args + ")";
            }

            parseFilter();
        };

        parseFilter();

        console.log(expr);

        var evalFunc = new Function("getValue", "sodaFilterMap", "return function sodaExp(scope){ return " + expr + "}")(getValue, sodaFilterMap);

        return evalFunc;
    };

    var parseChild = function(parent, scope){
        [].map.call([].slice.call(parent.childNodes, []), function(child){
            if(child.nodeType === 3){
                child.nodeValue = child.nodeValue.replace(valueoutReg, function(item, $1){
                    return parseSodaExpression($1)(scope); 
                });
            }

            if(child.attributes){
                // 优先处理 soda-repeat
                if(/in/.test(child.getAttribute("soda-repeat") || "")){
                    sodaDirectiveMap['soda-repeat'].link(scope, child, child.attributes);
                }else{
                    [].map.call(child.attributes, function(attr){
                        if(/^soda-/.test(attr.name)){
                            if(sodaDirectiveMap[attr.name]){
                                var dire = sodaDirectiveMap[attr.name]

                                dire.link(scope, child, child.attributes);
                            }

                        // 对其他属性里含expr 处理
                        }else{
                            attr.value = attr.value.replace(valueoutReg, function(item, $1){
                                return parseSodaExpression($1)(scope); 
                            });
                        }
                    });

                    parseChild(child, scope);
                }
            }
        });
    };

    var sodaDirectiveMap = {
    };

    var sodaFilterMap = {
    };

    var sodaDirective = function(name, func){
        sodaDirectiveMap['soda-' + name] = func();
    };

    var sodaFilter = function(name, func){
        sodaFilterMap[name] = func;
    };

    sodaFilter("date", function(input, lenth){
        return lenth;
    });

    sodaDirective('repeat', function(){
        return {
            compile: function(scope, el, attrs){
                
            },
            link: function(scope, el, attrs){
                var opt = el.getAttribute('soda-repeat');
                var itemName;
                var valueName;

                if(/in/.test(opt)){
                    opt = opt.split("in");

                    itemName = opt[0].trim();
                    valueName = opt[1].trim();
                }else{
                    return;
                }

                // 这里要处理一下
                var repeatObj = getValue(scope, valueName);
                var lastNode = el;

                for(var i = 0; i < repeatObj.length; i ++){
                    var itemNode = el.cloneNode();

                    var itemScope = {$index: i};
                    itemScope[itemName] = repeatObj[i];

                    itemScope.__proto__ = scope;

                    itemNode.innerHTML = el.innerHTML;

                    // 依次分析该节点上的其他属性
                    [].map.call(itemNode.attributes, function(attr){
                        if(itemNode.getAttribute("removed") === "removed"){
                            return;
                        }

                        if(attr.name.trim() !== "soda-repeat"){
                            if(/^soda-/.test(attr.name)){
                                if(sodaDirectiveMap[attr.name]){
                                    var dire = sodaDirectiveMap[attr.name]

                                    dire.link(itemScope, itemNode, itemNode.attributes);

                                }
                            }else{
                                attr.value = attr.value.replace(valueoutReg, function(item, $1){
                                    return parseSodaExpression($1)(itemScope); 
                                });
                            }
                        }
                    });

                    if(itemNode.getAttribute("removed") !== "removed"){
                        parseChild(itemNode, itemScope);

                        el.parentNode.insertBefore(itemNode, lastNode.nextSibling);

                        lastNode = itemNode;
                    }
                }

                el.parentNode.removeChild(el);

            }
        };
    });

    sodaDirective('if', function(){
        return {
            link: function(scope, el, attrs){
                var opt = el.getAttribute('soda-if');

                var expressFunc = parseSodaExpression(opt);

                console.log(expressFunc);

                if(expressFunc(scope)){
                }else{
                    el.setAttribute("removed", "removed");
                    el.parentNode && el.parentNode.removeChild(el);
                }
            }
        };
    });

    var sodaRender = function(str, data){
        // 解析模板DOM
        var div = document.createElement("div");

        div.innerHTML = str;


        parseChild(div, data);

        console.log(div);
        console.log(div.innerHTML);

        var frament = document.createDocumentFragment();
        frament.innerHTML = div.innerHTML;

        var child;
        while(child = div.childNodes[0]){
            frament.appendChild(child);
        }
        

        return frament;
    };

    window.sodaRender = sodaRender;
    window.sodaFilter = sodaFilter;
})();

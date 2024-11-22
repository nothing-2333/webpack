const fs = require("fs");
const path = require("path");
const parser = require("@babel/parser");
const traverse = require("@babel/traverse").default;
const babel = require("@babel/core");


/**
 * 分析单独模块
 * @param {string} file 
 */
function getModuleInfo(file)
{
    const body = fs.readFileSync(file, "utf-8");
    
    const ast = parser.parse(body, {
        sourceType: "module"
    });
    
    // 收集依赖项
    const deps = {}
    traverse(ast, {
        ImportDeclaration({ node })
        {   
            const dirname = path.dirname(file);
            const abspath = path.join('.', dirname, node.source.value);

            deps[node.source.value] = abspath;
        }
    })

    // ES6 => ES5
    const { code } = babel.transformFromAst(ast, null, {
        presets: ["@babel/preset-env"]
    });

    const moduleInfo = {file, deps, code };
    return moduleInfo;
}

/**
 * 递归获取依赖信息
 * @param {*} storage 
 * @param {*} info 
 */
function getDeps(storage, { deps })
{
    Object.keys(deps).forEach(key => {
        const child = getModuleInfo(deps[key]);
        storage.push(child);
        getDeps(storage, child);
    });
}

/**
 * 分析全部依赖模块
 * @param {string} file 
 */
function parseModules(file)
{
    const entry = getModuleInfo(file);
    const temp = [entry];

    const depsGraph = {};

    getDeps(temp, entry);

    temp.forEach(info => {
        depsGraph[info.file] = {
            deps: info.deps,
            code: info.code
        }
    });

    return depsGraph;
}

/**
 * 生成单个js
 * @param {string} file 
 * @returns 
 */
function bundle(file)
{
    const depsGraph = JSON.stringify(parseModules(file), null, 2);
    return `
!(function (graph) 
{
    function require(file)
    {
        function absRequire(relPath)
        {
            return require(graph[file].deps[relPath]);
        }
        var exports = {};
        (function (require, exports, code)
        {
            eval(code);
        })(absRequire, exports, graph[file].code);
        return exports
    }
    require('${file}')
})(${depsGraph});
    `
}
const content = bundle("./src/index.js");
console.log(content);

!fs.existsSync("./dist") && fs.mkdirSync("./dist");
fs.writeFileSync("./dist/bundle.js", content);
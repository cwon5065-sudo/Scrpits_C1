(function () {
    var comp = app.project.activeItem;
    if (!(comp instanceof CompItem)) {
        alert("컴포지션을 먼저 열어주세요.");
        return;
    }

    var fps = comp.frameRate;
    var CTRL_NAME = "Flicker Controller";

    // ===== UI =====
    var win = new Window("dialog", "Random Flicker");
    win.orientation = "column";
    win.alignChildren = "fill";
    win.margins = 16;
    win.spacing = 10;

    // --- 적용 대상 ---
    var pTarget = win.add("panel", undefined, "적용 대상");
    pTarget.orientation = "column";
    pTarget.alignChildren = "left";
    pTarget.margins = 14;
    var rbGroup = pTarget.add("radiobutton", undefined, "Shape 그룹 단위 (레이어 안의 Ellipse 각각)");
    var rbLayer = pTarget.add("radiobutton", undefined, "레이어 단위 (레이어 Opacity)");
    rbGroup.value = true;

    // --- 속도 ---
    var pSpeed = win.add("panel", undefined, "속도");
    pSpeed.orientation = "column";
    pSpeed.alignChildren = "fill";
    pSpeed.margins = 14;

    var rowFrames = pSpeed.add("group");
    rowFrames.add("statictext", undefined, "몇 프레임마다 바뀜:");
    var framesInput = rowFrames.add("edittext", undefined, "4");
    framesInput.characters = 4;
    rowFrames.add("statictext", undefined, "프레임");

    var framesSlider = pSpeed.add("slider", undefined, 4, 1, 30);
    var info = pSpeed.add("statictext", undefined, "");
    info.characters = 34;

    function updateInfo() {
        var n = parseInt(framesInput.text, 10);
        if (isNaN(n) || n < 1) { info.text = ""; return; }
        info.text = "= 초당 약 " + (fps / n).toFixed(1) + "회 변경 (" + fps + "fps 기준)";
    }
    framesSlider.onChanging = function () {
        framesInput.text = String(Math.round(framesSlider.value));
        updateInfo();
    };
    framesInput.onChanging = function () {
        var n = parseInt(framesInput.text, 10);
        if (!isNaN(n)) framesSlider.value = Math.max(1, Math.min(30, n));
        updateInfo();
    };
    updateInfo();

    // --- 모드 선택 ---
    var pMode = win.add("panel", undefined, "깜빡임 방식");
    pMode.orientation = "column";
    pMode.alignChildren = "left";
    pMode.margins = 14;

    var rbFlicker = pMode.add("radiobutton", undefined, "깜빡임 (뚝뚝 끊기게 켜짐/꺼짐)");
    var rbDissolve = pMode.add("radiobutton", undefined, "디졸브 (Opacity가 부드럽게 전환)");
    rbFlicker.value = true;

    var rowFade = pMode.add("group");
    rowFade.margins = [20, 0, 0, 0];
    rowFade.add("statictext", undefined, "디졸브 길이:");
    var fadeInput = rowFade.add("edittext", undefined, "4");
    fadeInput.characters = 4;
    rowFade.add("statictext", undefined, "프레임 (최대 = 바뀜 간격)");

    var easeCheck = pMode.add("checkbox", undefined, "이징 적용 (시작/끝을 더 부드럽게)");
    easeCheck.value = false;
    easeCheck.alignment = "left";

    function updateMode() {
        var on = rbDissolve.value;
        rowFade.enabled = on;
        easeCheck.enabled = on;
    }
    rbFlicker.onClick = updateMode;
    rbDissolve.onClick = updateMode;
    updateMode();

    // --- 깜빡임 설정 ---
    var pLook = win.add("panel", undefined, "깜빡임 설정");
    pLook.orientation = "column";
    pLook.alignChildren = "fill";
    pLook.margins = 14;

    function addRow(parent, label, def, suffix) {
        var g = parent.add("group");
        var t = g.add("statictext", undefined, label);
        t.preferredSize.width = 130;
        var e = g.add("edittext", undefined, String(def));
        e.characters = 5;
        g.add("statictext", undefined, suffix);
        return e;
    }

    var onInput = addRow(pLook, "켜져 있을 확률:", 60, "%");
    var maxInput = addRow(pLook, "켜졌을 때 Opacity:", 100, "%");
    var minInput = addRow(pLook, "꺼졌을 때 Opacity:", 0, "%");
    var seedInput = addRow(pLook, "시드(패턴 바꾸기):", 0, "");

    // --- 컨트롤러 ---
    var pCtrl = win.add("panel", undefined, "컨트롤러");
    pCtrl.orientation = "column";
    pCtrl.alignChildren = "left";
    pCtrl.margins = 14;
    var ctrlCheck = pCtrl.add("checkbox", undefined, "컨트롤러 레이어 만들기 (설정을 슬라이더로 나중에 조절)");
    ctrlCheck.value = true;
    pCtrl.add("statictext", undefined, "이미 \"" + CTRL_NAME + "\" 레이어가 있으면 그 레이어를 재사용하고,\n위 설정값으로 슬라이더 값을 갱신합니다.", { multiline: true });

    // --- 버튼 ---
    var btns = win.add("group");
    btns.alignment = "center";
    var applyBtn = btns.add("button", undefined, "적용", { name: "ok" });
    var removeBtn = btns.add("button", undefined, "효과 제거");
    var closeBtn = btns.add("button", undefined, "닫기", { name: "cancel" });

    // ===== 유틸 =====
    function getSelected() {
        var layers = comp.selectedLayers;
        if (layers.length === 0) {
            alert("깜빡이게 할 레이어를 선택해주세요. (Ctrl+A로 전체 선택)");
            return null;
        }
        return layers;
    }

    function num(input, def) {
        var v = parseFloat(input.text);
        return isNaN(v) ? def : v;
    }

    function getLayerOpacity(layer) {
        return layer.property("ADBE Transform Group").property("ADBE Opacity");
    }

    // Shape 레이어 안의 "가장 안쪽" 그룹들의 Opacity 속성을 모두 수집
    function collectGroupOpacities(contents, out) {
        for (var i = 1; i <= contents.numProperties; i++) {
            var p = contents.property(i);
            if (p.matchName === "ADBE Vector Group") {
                var inner = p.property("ADBE Vectors Group");
                var hasSub = false;
                for (var j = 1; j <= inner.numProperties; j++) {
                    if (inner.property(j).matchName === "ADBE Vector Group") {
                        hasSub = true;
                        break;
                    }
                }
                if (hasSub) {
                    collectGroupOpacities(inner, out);
                } else {
                    var tr = p.property("ADBE Vector Transform Group");
                    if (tr) out.push(tr.property("ADBE Vector Group Opacity"));
                }
            }
        }
    }

    function findController() {
        for (var i = 1; i <= comp.numLayers; i++) {
            if (comp.layer(i).name === CTRL_NAME) return comp.layer(i);
        }
        return null;
    }

    function setControl(layer, name, value) {
        var fx = layer.property("ADBE Effect Parade").property(name);
        if (fx) fx.property(1).setValue(value);
    }

    function addControl(layer, matchName, name, value) {
        var fx = layer.property("ADBE Effect Parade").addProperty(matchName);
        fx.name = name;
        fx.property(1).setValue(value);
    }

    // 컨트롤러(Null 레이어)를 만들거나 기존 것을 갱신
    function ensureController(s) {
        var c = findController();
        if (c) {
            setControl(c, "Frames Interval", s.n);
            setControl(c, "Dissolve (On/Off)", s.dissolve ? 1 : 0);
            setControl(c, "Dissolve Length", s.fade);
            setControl(c, "Ease (On/Off)", s.ease ? 1 : 0);
            setControl(c, "On Chance %", s.chance * 100);
            setControl(c, "Max Opacity", s.maxOp);
            setControl(c, "Min Opacity", s.minOp);
            setControl(c, "Seed", s.seed);
            return c;
        }
        c = comp.layers.addNull(comp.duration);
        c.name = CTRL_NAME;
        c.label = 11; // 보라색 계열
        c.moveToBeginning();
        addControl(c, "ADBE Slider Control", "Frames Interval", s.n);
        addControl(c, "ADBE Checkbox Control", "Dissolve (On/Off)", s.dissolve ? 1 : 0);
        addControl(c, "ADBE Slider Control", "Dissolve Length", s.fade);
        addControl(c, "ADBE Checkbox Control", "Ease (On/Off)", s.ease ? 1 : 0);
        addControl(c, "ADBE Slider Control", "On Chance %", s.chance * 100);
        addControl(c, "ADBE Slider Control", "Max Opacity", s.maxOp);
        addControl(c, "ADBE Slider Control", "Min Opacity", s.minOp);
        addControl(c, "ADBE Slider Control", "Seed", s.seed);
        return c;
    }

    // 컨트롤러를 읽어서 동작하는 expression
    function buildControllerExpr(uid) {
        return "var c = thisComp.layer(\"" + CTRL_NAME + "\");\n" +
            "var N = Math.max(1, Math.round(c.effect(\"Frames Interval\")(1)));\n" +
            "var dis = c.effect(\"Dissolve (On/Off)\")(1) == 1;\n" +
            "var F = dis ? Math.max(1, Math.min(N, Math.round(c.effect(\"Dissolve Length\")(1)))) : 1;\n" +
            "var ease = c.effect(\"Ease (On/Off)\")(1) == 1;\n" +
            "var chance = c.effect(\"On Chance %\")(1) / 100;\n" +
            "var maxOp = c.effect(\"Max Opacity\")(1);\n" +
            "var minOp = c.effect(\"Min Opacity\")(1);\n" +
            "var sd = Math.round(c.effect(\"Seed\")(1));\n" +
            "var fr = timeToFrames(time);\n" +
            "var step = Math.floor(fr / N);\n" +
            "var local = fr - step * N;\n" +
            "function val(s) {\n" +
            "  seedRandom(index * 100003 + " + uid + " * 1009 + sd * 7919 + s, true);\n" +
            "  return random() < chance ? maxOp : minOp;\n" +
            "}\n" +
            "var cur = val(step);\n" +
            "var prev = val(step - 1);\n" +
            "var t = Math.min(1, (local + 1) / F);\n" +
            "if (ease) t = t * t * (3 - 2 * t);\n" +
            "prev + (cur - prev) * t;";
    }

    // 값을 직접 박아 넣는 expression (컨트롤러 없이 사용)
    function buildFixedExpr(s, uid) {
        var base = "index * 100003 + " + uid + " * 1009 + " + (s.seed * 7919);
        return "var N = " + s.n + "; // 몇 프레임마다 바뀔지\n" +
            "var F = " + s.fade + "; // 디졸브 길이(프레임)\n" +
            "var fr = timeToFrames(time);\n" +
            "var step = Math.floor(fr / N);\n" +
            "var local = fr - step * N;\n" +
            "function val(s) {\n" +
            "  seedRandom(" + base + " + s, true);\n" +
            "  return random() < " + s.chance + " ? " + s.maxOp + " : " + s.minOp + ";\n" +
            "}\n" +
            "var cur = val(step);\n" +
            "var prev = val(step - 1);\n" +
            "var t = Math.min(1, (local + 1) / F);\n" +
            (s.ease ? "t = t * t * (3 - 2 * t);\n" : "") +
            "prev + (cur - prev) * t;";
    }

    // ===== 적용 =====
    applyBtn.onClick = function () {
        var layers = getSelected();
        if (!layers) return;

        var n = Math.max(1, Math.round(num(framesInput, 4)));
        var s = {
            n: n,
            chance: Math.max(0, Math.min(100, num(onInput, 60))) / 100,
            maxOp: num(maxInput, 100),
            minOp: num(minInput, 0),
            seed: Math.round(num(seedInput, 0)),
            dissolve: rbDissolve.value,
            fade: 1,
            ease: false
        };
        if (s.dissolve) {
            s.fade = Math.max(1, Math.min(n, Math.round(num(fadeInput, n))));
            s.ease = easeCheck.value;
        } else {
            s.fade = Math.max(1, Math.min(n, Math.round(num(fadeInput, n))));
        }
        var groupMode = rbGroup.value;
        var useCtrl = ctrlCheck.value;

        // 선택 레이어를 먼저 확보 (컨트롤러 생성 시 선택이 바뀔 수 있음)
        var targetsLayers = [];
        for (var a = 0; a < layers.length; a++) {
            if (layers[a].name !== CTRL_NAME) targetsLayers.push(layers[a]);
        }
        if (targetsLayers.length === 0) {
            alert("컨트롤러 레이어 말고 깜빡이게 할 레이어를 선택해주세요.");
            return;
        }

        var count = 0;
        app.beginUndoGroup("Random Flicker");
        if (useCtrl) ensureController(s);

        // 고정값 모드일 때 디졸브가 꺼져 있으면 F=1
        var fixed = {
            n: s.n, chance: s.chance, maxOp: s.maxOp, minOp: s.minOp, seed: s.seed,
            fade: s.dissolve ? s.fade : 1, ease: s.ease
        };

        for (var i = 0; i < targetsLayers.length; i++) {
            var layer = targetsLayers[i];

            if (groupMode && layer instanceof ShapeLayer) {
                var targets = [];
                collectGroupOpacities(layer.property("ADBE Root Vectors Group"), targets);
                if (targets.length > 0) {
                    for (var k = 0; k < targets.length; k++) {
                        targets[k].expression = useCtrl
                            ? buildControllerExpr(k + 1)
                            : buildFixedExpr(fixed, k + 1);
                    }
                    count += targets.length;
                    continue;
                }
            }

            getLayerOpacity(layer).expression = useCtrl
                ? buildControllerExpr(0)
                : buildFixedExpr(fixed, 0);
            count++;
        }
        app.endUndoGroup();

        alert(count + "개 대상에 적용했습니다." +
            (useCtrl ? "\n\n'" + CTRL_NAME + "' 레이어의 Effect Controls에서 값을 조절하세요." : ""));
    };

    // ===== 제거 =====
    removeBtn.onClick = function () {
        var layers = getSelected();
        if (!layers) return;

        app.beginUndoGroup("Remove Random Flicker");
        for (var i = 0; i < layers.length; i++) {
            var layer = layers[i];
            if (layer.name === CTRL_NAME) continue;

            if (layer instanceof ShapeLayer) {
                var targets = [];
                collectGroupOpacities(layer.property("ADBE Root Vectors Group"), targets);
                for (var k = 0; k < targets.length; k++) {
                    targets[k].expression = "";
                    targets[k].setValue(100);
                }
            }

            var op = getLayerOpacity(layer);
            op.expression = "";
            op.setValue(100);
        }
        app.endUndoGroup();
    };

    closeBtn.onClick = function () { win.close(); };

    win.center();
    win.show();
})();

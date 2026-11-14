/*
    Allign.c1
    기준 레이어(A)는 그대로 두고, 선택한 레이어(B)를 A 기준으로 정렬하는 After Effects 패널.

    설치: 이 파일을 After Effects 설치 폴더의 Scripts/ScriptUI Panels 폴더에 넣고
          After Effects를 다시 실행한 뒤 Window(창) 메뉴에서 "Allign.c1.jsx"를 엽니다.
    (File > Scripts > Run Script File 로 바로 실행해도 됩니다.)

    사용법
      1) A 레이어를 선택하고 [A 지정] 클릭
      2) B 레이어(여러 개 가능)를 선택하고 정렬 버튼 클릭
      * A를 지정하지 않았다면: 선택한 레이어를 컴포지션 크기 기준으로 정렬합니다.

    윗줄 오른쪽 4개 버튼은 PinToTop 기능입니다.
      (선택 레이어 상단 고정 / 고정 해제 / 현재 컴프 전부 해제 / 일시정지·다시 시작)
*/
// PinToTop 감시 타이머가 계속 돌 수 있도록 전용 엔진 사용 (PinToTop.jsx와 상태 공유)
#targetengine "PinTopEngine"

(function allignC1(thisObj) {

    var SCRIPT_NAME = "Allign.c1";
    var refLayer = null;      // 고정된 기준 레이어(A)
    var refText = null;       // 패널의 A 표시 텍스트
    var statusText = null;    // 패널의 상태 표시 텍스트

    // ---------- 공통 ----------

    function getComp() {
        var item = app.project ? app.project.activeItem : null;
        return (item && item instanceof CompItem) ? item : null;
    }

    function refIsValid(comp) {
        try {
            return refLayer !== null && isValid(refLayer) && refLayer.containingComp.id === comp.id;
        } catch (e) {
            return false;
        }
    }

    function setStatus(msg) {
        if (statusText) { statusText.text = msg; }
    }

    function updateRefText() {
        if (!refText) { return; }
        var name = null;
        try {
            if (refLayer !== null && isValid(refLayer)) { name = refLayer.name; }
        } catch (e) {}
        refText.helpTip = name ? ("A 지정 (현재 A: " + name + ")") : "A 지정 (현재 미지정: 컴포지션 기준으로 정렬)";
    }

    // ---------- 측정용 익스프레션 ----------

    // 임시 포인트 컨트롤에 익스프레션을 넣어 값을 읽어온다. 실패하면 null.
    function evalPoint(pointProp, expr, t) {
        try {
            pointProp.expression = expr;
            var v = pointProp.valueAtTime(t, false);
            if (pointProp.expressionError !== "") { return null; }
            return v;
        } catch (e) {
            return null;
        }
    }

    // 레이어의 네 모서리를 컴프 좌표로 바꾼 뒤 최소/최대 좌표를 돌려주는 익스프레션
    function boundsExpr(layerIndex, fn) {
        return "var L=thisComp.layer(" + layerIndex + ");" +
               "var r=L.sourceRectAtTime(time,false);" +
               "var c=[[r.left,r.top],[r.left+r.width,r.top],[r.left,r.top+r.height],[r.left+r.width,r.top+r.height]];" +
               "var x=[],y=[];" +
               "for(var i=0;i<4;i++){var p=L.toComp(c[i]);x.push(p[0]);y.push(p[1]);}" +
               "[Math." + fn + ".apply(null,x),Math." + fn + ".apply(null,y)];";
    }

    // 부모가 있는 레이어: 컴프 기준 이동량을 부모 좌표계의 새 Position으로 변환
    function parentPosExpr(layerIndex, dx, dy) {
        return "var L=thisComp.layer(" + layerIndex + ");" +
               "var a=L.toComp(L.anchorPoint);" +
               "var q=L.parent.fromComp([a[0]+(" + dx + "),a[1]+(" + dy + ")]);" +
               "[q[0],q[1]];";
    }

    function measure(layer, pointProp, t) {
        var mn = evalPoint(pointProp, boundsExpr(layer.index, "min"), t);
        var mx = evalPoint(pointProp, boundsExpr(layer.index, "max"), t);
        if (!mn || !mx) { return null; }
        return { left: mn[0], top: mn[1], right: mx[0], bottom: mx[1] };
    }

    // ---------- 이동 ----------

    function setProp(prop, val, t) {
        if (prop.numKeys > 0) {
            prop.setValueAtTime(t, val);
        } else {
            prop.setValue(val);
        }
    }

    function moveLayer(layer, dx, dy, pointProp, t) {
        var tg = layer.property("ADBE Transform Group");
        var pos = tg.property("ADBE Position");
        var separated = pos.dimensionsSeparated;
        var xp = separated ? tg.property("ADBE Position_0") : null;
        var yp = separated ? tg.property("ADBE Position_1") : null;

        // Position에 익스프레션이 걸려 있으면 값을 바꿔도 의미가 없으므로 건너뜀
        if (separated) {
            if ((xp.expressionEnabled && dx !== 0) || (yp.expressionEnabled && dy !== 0)) { return false; }
        } else if (pos.expressionEnabled) {
            return false;
        }

        var cur = separated ? [xp.valueAtTime(t, true), yp.valueAtTime(t, true)]
                            : pos.valueAtTime(t, true);
        var nx, ny;

        if (layer.parent) {
            var q = evalPoint(pointProp, parentPosExpr(layer.index, dx, dy), t);
            if (!q) { return false; }
            nx = q[0];
            ny = q[1];
        } else {
            nx = cur[0] + dx;
            ny = cur[1] + dy;
        }

        if (separated) {
            setProp(xp, nx, t);
            setProp(yp, ny, t);
        } else {
            var v = [];
            for (var i = 0; i < cur.length; i++) { v.push(cur[i]); }
            v[0] = nx;
            v[1] = ny;
            setProp(pos, v, t);
        }
        return true;
    }

    // ---------- 정렬 실행 ----------
    // hMode: null | "left" | "center" | "right"
    // vMode: null | "top"  | "center" | "bottom"
    function run(hMode, vMode) {
        var comp = getComp();
        if (!comp) {
            alert("컴포지션을 먼저 열어 주세요.", SCRIPT_NAME);
            return;
        }

        var sel = [];
        var raw = comp.selectedLayers;
        var i;
        for (i = 0; i < raw.length; i++) { sel.push(raw[i]); }

        var A = null;
        var targets = [];

        if (refIsValid(comp)) {
            A = refLayer;
            for (i = 0; i < sel.length; i++) {
                if (sel[i].index !== A.index) { targets.push(sel[i]); }
            }
            if (targets.length === 0) {
                alert("정렬할 레이어(B)를 선택해 주세요.", SCRIPT_NAME);
                return;
            }
        } else {
            // A를 지정하지 않았으면 컴포지션 크기를 기준으로 정렬
            refLayer = null;
            updateRefText();
            if (sel.length < 1) {
                alert("정렬할 레이어를 선택해 주세요.", SCRIPT_NAME);
                return;
            }
            for (i = 0; i < sel.length; i++) { targets.push(sel[i]); }
        }

        var t = comp.time;
        var moved = 0;
        var skipped = 0;
        var temp = null;
        var errorMsg = null;

        app.beginUndoGroup(SCRIPT_NAME);
        try {
            // 측정용 임시 레이어 (끝나면 삭제)
            temp = comp.layers.addShape();
            temp.name = "__AllignC1_temp__";
            temp.enabled = false;
            var fx = temp.property("ADBE Effect Parade").addProperty("ADBE Point Control");
            var pt = fx.property("ADBE Point Control-0001");

            var a = A ? measure(A, pt, t)
                      : { left: 0, top: 0, right: comp.width, bottom: comp.height };
            if (!a) {
                errorMsg = "기준 레이어(A)의 크기를 읽을 수 없습니다.\n(카메라·조명 레이어는 기준으로 쓸 수 없습니다.)";
            } else {
                for (i = 0; i < targets.length; i++) {
                    var L = targets[i];
                    var ok = false;
                    try {
                        var b = measure(L, pt, t);
                        if (b) {
                            var dx = 0;
                            var dy = 0;
                            if (hMode === "left")   { dx = a.left - b.left; }
                            if (hMode === "center") { dx = (a.left + a.right) / 2 - (b.left + b.right) / 2; }
                            if (hMode === "right")  { dx = a.right - b.right; }
                            if (vMode === "top")    { dy = a.top - b.top; }
                            if (vMode === "center") { dy = (a.top + a.bottom) / 2 - (b.top + b.bottom) / 2; }
                            if (vMode === "bottom") { dy = a.bottom - b.bottom; }
                            ok = moveLayer(L, dx, dy, pt, t);
                        }
                    } catch (eLayer) {
                        ok = false;   // 잠긴 레이어 등
                    }
                    if (ok) { moved++; } else { skipped++; }
                }
            }
        } catch (e) {
            errorMsg = "오류: " + e.toString();
        } finally {
            try { if (temp) { temp.remove(); } } catch (e2) {}
            // 선택 상태 복원
            try {
                for (i = 0; i < sel.length; i++) { sel[i].selected = true; }
            } catch (e3) {}
            app.endUndoGroup();
        }

        if (errorMsg) {
            alert(errorMsg, SCRIPT_NAME);
            setStatus("실패");
            return;
        }
        setStatus(moved + "개 정렬" + (skipped > 0 ? (", " + skipped + "개 건너뜀") : "") + "  (기준: " + (A ? A.name : "컴포지션") + ")");
        if (skipped > 0) {
            alert(skipped + "개 레이어는 건너뛰었습니다.\n(잠긴 레이어, Position에 익스프레션이 있는 레이어, 카메라·조명)", SCRIPT_NAME);
        }
    }

    // ---------- UI ----------

    // 단색 사각형 아이콘 버튼 (A 지정 = 빨강, A 해제 = 파랑)
    function addSquareBtn(parent, color, tip, fn) {
        var SIZE = 22;
        var PAD = 5;

        var b = parent.add("button", undefined, "");
        b.preferredSize = [SIZE, SIZE];
        b.minimumSize = [SIZE, SIZE];
        b.maximumSize = [SIZE, SIZE];
        b.helpTip = tip;
        b.onClick = fn;

        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var over = state && state.mouseOver;
            var down = state && state.leftButtonPressed;

            var bgColor = down ? [0.13, 0.13, 0.13, 1] : (over ? [0.33, 0.33, 0.33, 1] : [0.21, 0.21, 0.21, 1]);
            g.newPath();
            g.rectPath(0, 0, w, h);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, bgColor));

            g.newPath();
            g.rectPath(PAD, PAD, w - PAD * 2, h - PAD * 2);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, color));
        };
        return b;
    }

    // 아이콘 버튼: 큰 사각형 테두리(A) 안에 파란 사각형(B)이 놓일 위치를 그려서 보여준다.
    function addIconBtn(parent, col, row, tip, hMode, vMode) {
        var SIZE = 22;   // 버튼 크기
        var PAD = 3;     // A 테두리까지 여백
        var BS = 6;      // B 사각형 크기
        var GAP = 1;     // A 테두리와 B 사이 간격

        var b = parent.add("button", undefined, "");
        b.preferredSize = [SIZE, SIZE];
        b.minimumSize = [SIZE, SIZE];
        b.maximumSize = [SIZE, SIZE];
        b.helpTip = tip;
        b.onClick = function () { run(hMode, vMode); };

        b.onDraw = function (state) {
            var g = this.graphics;
            var w = this.size[0];
            var h = this.size[1];
            var over = state && state.mouseOver;
            var down = state && state.leftButtonPressed;

            // 배경
            var bgColor = down ? [0.13, 0.13, 0.13, 1] : (over ? [0.33, 0.33, 0.33, 1] : [0.21, 0.21, 0.21, 1]);
            g.newPath();
            g.rectPath(0, 0, w, h);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, bgColor));

            // A (테두리)
            var aw = w - PAD * 2;
            var ah = h - PAD * 2;
            g.newPath();
            g.rectPath(PAD, PAD, aw, ah);
            g.strokePath(g.newPen(g.PenType.SOLID_COLOR, over ? [0.85, 0.85, 0.85, 1] : [0.6, 0.6, 0.6, 1], 1));

            // B (채워진 사각형)
            // (ExtendScript는 중첩 삼항 연산자를 잘못 해석하므로 if 문으로 처리)
            var bx = PAD + (aw - BS) / 2;
            var by = PAD + (ah - BS) / 2;
            if (col === 0) { bx = PAD + GAP; }
            if (col === 2) { bx = PAD + aw - BS - GAP; }
            if (row === 0) { by = PAD + GAP; }
            if (row === 2) { by = PAD + ah - BS - GAP; }
            g.newPath();
            g.rectPath(bx, by, BS, BS);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, [0.2, 0.62, 1, 1]));
        };
        return b;
    }

    // ==================== PinToTop (레이어 상단 고정) ====================
    var TAG = "[PIN_TOP]";        // 고정 레이어
    var ABOVE = "[ABOVE_PIN]";    // 고정 레이어보다 위에 두기로 한 레이어
    var INTERVAL = 300;           // ms, 감시 주기
    var SCAN_EVERY = 15;          // 틱 X번마다 프로젝트 전체에서 고정 컴프 탐색
    var STALE_MS = 3000;          // 이 시간 이상 감시가 멈춰 있으면 버튼 클릭 시 재시작

    var G = $.global.PinTop = $.global.PinTop || {};
    G.lastSig = G.lastSig || {};
    G.skipSig = G.skipSig || {};
    G.comps = G.comps || {};
    if (G.taskId === undefined) G.taskId = null;
    if (G.paused === undefined) G.paused = false;
    G.tickCount = G.tickCount || 0;
    G.lastTick = G.lastTick || 0;
    if (G.projKey === undefined) G.projKey = null;

    // ---------- 태그 헬퍼 ----------
    function hasTag(layer, tag) {
        return layer.comment && layer.comment.indexOf(tag) !== -1;
    }
    function isPinned(layer) { return hasTag(layer, TAG); }
    function isAbove(layer) { return hasTag(layer, ABOVE) && !isPinned(layer); }

    function withUnlocked(layer, fn) {
        var wasLocked = layer.locked;
        if (wasLocked) layer.locked = false;
        try { fn(); } finally { if (wasLocked) layer.locked = true; }
    }

    function setTag(layer, tag, on) {
        if (on === hasTag(layer, tag)) return;
        withUnlocked(layer, function () {
            if (on) layer.comment = tag + (layer.comment ? " " + layer.comment : "");
            else layer.comment = layer.comment.replace(tag, "").replace(/^\s+/, "");
        });
    }

    // ---------- 순서 계산 ----------
    function collect(comp) {
        var A = [], P = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var ly = comp.layer(i);
            if (isPinned(ly)) P.push(ly);
            else if (isAbove(ly)) A.push(ly);
        }
        return { A: A, P: P };
    }

    // 올바른 순서: [위에 두기로 한 레이어들] → [고정 레이어들] → 나머지
    function isViolated(comp) {
        var s = collect(comp);
        if (!s.P.length) return false;
        for (var j = 0; j < s.A.length; j++) if (s.A[j].index !== j + 1) return true;
        for (var k = 0; k < s.P.length; k++) if (s.P[k].index !== s.A.length + k + 1) return true;
        return false;
    }

    function moveTop(ly) { withUnlocked(ly, function () { ly.moveToBeginning(); }); }

    function enforce(comp) {
        if (!isViolated(comp)) return;
        var s = collect(comp);
        app.beginUndoGroup("Pin Top 유지");
        try {
            var k;
            for (k = s.P.length - 1; k >= 0; k--) moveTop(s.P[k]);
            for (k = s.A.length - 1; k >= 0; k--) moveTop(s.A[k]);
        } finally {
            app.endUndoGroup();
        }
    }

    function signature(comp) {
        var parts = [];
        for (var i = 1; i <= comp.numLayers; i++) {
            var ly = comp.layer(i);
            var key = (ly.id !== undefined) ? ly.id : ly.name;
            parts.push(key + (isPinned(ly) ? "*" : "") + (isAbove(ly) ? "^" : ""));
        }
        return parts.join("|");
    }

    // ---------- 컴프 탐색 ----------
    function activeComp() {
        if (!app.project) return null;
        var c = app.project.activeItem;
        return (c && c instanceof CompItem) ? c : null;
    }

    function findComp(id) {
        try {
            if (app.project.itemByID) {
                var it = app.project.itemByID(id);
                return (it && it instanceof CompItem) ? it : null;
            }
        } catch (e) {}
        for (var i = 1; i <= app.project.numItems; i++) {
            var x = app.project.item(i);
            if (x.id === id && x instanceof CompItem) return x;
        }
        return null;
    }

    function scanProject() {
        var found = {};
        for (var i = 1; i <= app.project.numItems; i++) {
            var it = app.project.item(i);
            if (it instanceof CompItem && collect(it).P.length) found[it.id] = true;
        }
        G.comps = found;
    }

    function checkProject() {
        var key = app.project ? (app.project.file ? app.project.file.fsName : "untitled") : null;
        if (key !== G.projKey) {
            G.projKey = key;
            G.lastSig = {}; G.skipSig = {}; G.comps = {};
            if (app.project) scanProject();
        }
    }

    function eachTrackedComp(fn) {
        var ac = activeComp();
        if (ac && collect(ac).P.length) G.comps[ac.id] = true;
        for (var id in G.comps) {
            if (!G.comps.hasOwnProperty(id)) continue;
            try {
                var c = findComp(parseInt(id, 10));
                if (!c) { delete G.comps[id]; continue; }
                fn(c);
            } catch (e) {}
        }
    }

    // ---------- 감시 ----------
    function checkComp(c) {
        var id = c.id;
        var sig = signature(c);
        if (sig === G.lastSig[id]) return;

        if (!isViolated(c)) {
            G.skipSig[id] = null;
            G.lastSig[id] = sig;
            return;
        }
        if (sig === G.skipSig[id]) {      // Ctrl+Z로 자동 정렬을 취소한 상태
            G.skipSig[id] = null;
            G.lastSig[id] = sig;
            return;
        }
        enforce(c);
        G.skipSig[id] = sig;
        G.lastSig[id] = signature(c);
    }

    G.tick = function () {
        G.lastTick = new Date().getTime();
        if (G.paused) return;
        G.tickCount++;
        try {
            if (!app.project) return;
            checkProject();
            if (G.tickCount % SCAN_EVERY === 0) scanProject();
            eachTrackedComp(checkComp);
        } catch (e) {}
    };

    G.resync = function (c) {
        G.skipSig[c.id] = null;
        G.lastSig[c.id] = signature(c);
        if (collect(c).P.length) G.comps[c.id] = true;
    };

    G.start = function () {
        if (G.taskId !== null) { try { app.cancelTask(G.taskId); } catch (e) {} }
        G.lastTick = new Date().getTime();
        G.taskId = app.scheduleTask("PinTop.tick()", INTERVAL, true);
    };
    G.ensureAlive = function () {
        if (G.taskId === null || new Date().getTime() - G.lastTick > STALE_MS) G.start();
    };

    // 다시 시작할 때: 지금 고정 레이어보다 위에 있는 레이어를 "위에 두기"로 기록
    function captureAbove(c) {
        var firstPinned = 0;
        for (var i = 1; i <= c.numLayers; i++) {
            if (isPinned(c.layer(i))) { firstPinned = i; break; }
        }
        for (var j = 1; j <= c.numLayers; j++) {
            var ly = c.layer(j);
            if (isPinned(ly)) continue;
            setTag(ly, ABOVE, firstPinned > 0 && j < firstPinned);
        }
    }

    // PinToTop 아이콘 버튼 4개를 parent 그룹에 추가
    function addPinButtons(parent) {
        var ICON = 22;                          // 버튼 크기(px)
        var C_LIGHT = [0.88, 0.88, 0.88, 1];
        var C_DIM = [0.55, 0.55, 0.55, 1];
        var C_BLUE = [0.2, 0.62, 1, 1];
        var C_RED = [0.95, 0.27, 0.27, 1];
        var C_GREEN = [0.3, 0.82, 0.42, 1];

        function fillRect(g, x, y, w, h, color) {
            g.newPath();
            g.rectPath(x, y, w, h);
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, color));
        }
        function fillTri(g, x1, y1, x2, y2, x3, y3, color) {
            g.newPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.lineTo(x3, y3);
            g.closePath();
            g.fillPath(g.newBrush(g.BrushType.SOLID_COLOR, color));
        }
        function drawLine(g, x1, y1, x2, y2, color, width) {
            g.newPath();
            g.moveTo(x1, y1);
            g.lineTo(x2, y2);
            g.strokePath(g.newPen(g.PenType.SOLID_COLOR, color, width));
        }

        function addPinBtn(parent, tip, drawIcon) {
            var b = parent.add("button", undefined, "");
            b.preferredSize = [ICON, ICON];
            b.minimumSize = [ICON, ICON];
            b.maximumSize = [ICON, ICON];
            b.helpTip = tip;
            b.onDraw = function (state) {
                var g = this.graphics;
                var over = state && state.mouseOver;
                var down = state && state.leftButtonPressed;
                var bg = [0.21, 0.21, 0.21, 1];
                if (over) bg = [0.33, 0.33, 0.33, 1];
                if (down) bg = [0.13, 0.13, 0.13, 1];
                fillRect(g, 0, 0, this.size[0], this.size[1], bg);
                drawIcon(g);
            };
            return b;
        }

        // 맨 위 선 + 위쪽 화살표 (최상단으로 올림)
        function drawTopArrow(g, barColor, arrowColor) {
            fillRect(g, 5, 4, 12, 2, barColor);
            fillTri(g, 11, 8, 6, 14, 16, 14, arrowColor);
            fillRect(g, 9.5, 14, 3, 4, arrowColor);
        }

        // 1) 선택 레이어 상단 고정: 파란 선 + 화살표
        var btnPin = addPinBtn(parent, "선택 레이어 상단 고정", function (g) {
            drawTopArrow(g, C_BLUE, C_LIGHT);
        });

        // 2) 선택 레이어 고정 해제: 회색 화살표에 빨간 사선
        var btnUnpin = addPinBtn(parent, "선택 레이어 고정 해제", function (g) {
            drawTopArrow(g, C_DIM, C_DIM);
            drawLine(g, 4, 18, 18, 4, C_RED, 2);
        });

        // 3) 현재 컴프 고정 전부 해제: 빨간 X
        var btnClear = addPinBtn(parent, "현재 컴프 고정 전부 해제", function (g) {
            drawLine(g, 6, 6, 16, 16, C_RED, 2);
            drawLine(g, 16, 6, 6, 16, C_RED, 2);
        });

        // 4) 일시정지 / 다시 시작: 작동 중이면 ❚❚, 일시정지 중이면 초록 ▶
        var btnPause = addPinBtn(parent, "", function (g) {
            if (G.paused) {
                fillTri(g, 8, 5, 8, 17, 17, 11, C_GREEN);
            } else {
                fillRect(g, 7, 6, 3, 10, C_LIGHT);
                fillRect(g, 12, 6, 3, 10, C_LIGHT);
            }
        });

        function updateUI() {
            btnPause.helpTip = G.paused ? "다시 시작 (현재: 일시정지)" : "일시정지 (현재: 작동 중)";
            try { btnPause.notify("onDraw"); } catch (e) {}   // 아이콘 다시 그리기
        }

        btnPin.onClick = function () {
            G.ensureAlive();
            var c = activeComp();
            if (!c) { alert("타임라인에서 컴포지션을 먼저 선택해주세요."); return; }
            var sel = c.selectedLayers;
            if (!sel.length) { alert("고정할 레이어를 선택해주세요."); return; }
            app.beginUndoGroup("Pin Top 설정");
            try {
                for (var i = 0; i < sel.length; i++) {
                    setTag(sel[i], ABOVE, false);
                    setTag(sel[i], TAG, true);
                }
            } finally { app.endUndoGroup(); }
            if (!G.paused) enforce(c);
            G.resync(c);
        };

        btnUnpin.onClick = function () {
            G.ensureAlive();
            var c = activeComp();
            if (!c) return;
            var sel = c.selectedLayers;
            app.beginUndoGroup("Pin Top 해제");
            try {
                for (var i = 0; i < sel.length; i++) setTag(sel[i], TAG, false);
                if (!collect(c).P.length) {          // 고정 레이어가 없으면 "위에 두기" 표시도 정리
                    for (var j = 1; j <= c.numLayers; j++) setTag(c.layer(j), ABOVE, false);
                }
            } finally { app.endUndoGroup(); }
            G.resync(c);
        };

        btnClear.onClick = function () {
            G.ensureAlive();
            var c = activeComp();
            if (!c) return;
            app.beginUndoGroup("Pin Top 전부 해제");
            try {
                for (var i = 1; i <= c.numLayers; i++) {
                    setTag(c.layer(i), TAG, false);
                    setTag(c.layer(i), ABOVE, false);
                }
            } finally { app.endUndoGroup(); }
            G.resync(c);
        };

        btnPause.onClick = function () {
            G.ensureAlive();
            if (!G.paused) {
                G.paused = true;
            } else {
                app.beginUndoGroup("Pin Top 다시 시작");
                try {
                    eachTrackedComp(function (c) { captureAbove(c); G.resync(c); });
                } finally { app.endUndoGroup(); }
                G.paused = false;
            }
            updateUI();
        };

        // 패널을 다시 열거나 워크스페이스를 바꿔 재실행되면 감시도 새로 시작
        G.start();
        updateUI();
    }

    // ==================== Allign.c1 UI ====================

    function buildUI(obj) {
        var win = (obj instanceof Panel) ? obj
                : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });
        win.orientation = "column";
        win.alignChildren = ["left", "top"];
        win.spacing = 2;
        win.margins = 4;

        // 1줄: A 지정(빨강) / A 해제(파랑)
        var refRow = win.add("group");
        refRow.orientation = "row";
        refRow.alignment = ["left", "top"];
        refRow.alignChildren = ["left", "center"];
        refRow.spacing = 2;

        // 2줄: 정렬 아이콘 9개 (텍스트 없음, 설명은 툴팁으로만)
        var iconRow = win.add("group");
        iconRow.orientation = "row";
        iconRow.alignment = ["left", "top"];
        iconRow.alignChildren = ["left", "center"];
        iconRow.spacing = 2;

        // 빨간 사각형 = A 지정 (현재 A 이름은 이 버튼의 툴팁에 표시)
        refText = addSquareBtn(refRow,[0.92, 0.22, 0.22, 1], "", function () {
            var comp = getComp();
            if (!comp || comp.selectedLayers.length !== 1) {
                alert("기준으로 쓸 레이어를 하나만 선택해 주세요.", SCRIPT_NAME);
                return;
            }
            refLayer = comp.selectedLayers[0];
            updateRefText();
        });
        updateRefText();

        // 파란 사각형 = A 해제
        addSquareBtn(refRow, [0.2, 0.45, 1, 1], "A 해제 (컴포지션 기준으로 정렬합니다)", function () {
            refLayer = null;
            updateRefText();
        });

        // PinToTop 버튼 4개를 오른쪽 끝으로: 아랫줄(아이콘 9개)의 마지막 4칸 바로 위에 오도록
        // 아이콘 3칸(22px) + 간격 2개(2px) 만큼 빈 공간을 둔다.
        var pinGap = refRow.add("group");
        pinGap.preferredSize = [70, 22];
        pinGap.minimumSize = [70, 22];
        pinGap.maximumSize = [70, 22];
        addPinButtons(refRow);

        // 3x3 아이콘 그리드: 칸의 위치 = A 안에서 B가 놓일 위치
        var H_MODES = ["left", "center", "right"];
        var V_MODES = ["top", "center", "bottom"];
        var TIPS = [
            ["왼쪽 위", "위", "오른쪽 위"],
            ["왼쪽", "정중앙", "오른쪽"],
            ["왼쪽 아래", "아래", "오른쪽 아래"]
        ];

        for (var r = 0; r < 3; r++) {
            for (var c = 0; c < 3; c++) {
                addIconBtn(iconRow, c, r, TIPS[r][c], H_MODES[c], V_MODES[r]);
            }
        }

        win.layout.layout(true);
        win.onResizing = win.onResize = function () { this.layout.resize(); };
        return win;
    }

    var ui = buildUI(thisObj);
    if (ui instanceof Window) {
        ui.center();
        ui.show();
    }

})(this);

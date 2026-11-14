/*
  Fill Comp Shape  (FillCompShape.jsx)
  ------------------------------------------------------------
  활성 컴포지션의 크기에 여백 없이 꼭 맞는(또는 컴프 전체를 덮는)
  Shape Layer를 한 번에 만들어 주는 스크립트.

  설치:
    - 패널로 쓰기: After Effects/Scripts/ScriptUI Panels 폴더에 복사 후
      Window 메뉴에서 FillCompShape 선택
    - 한 번만 실행: File > Script > Run Script File...

  개수:
    가로 x 세로 개수를 지정하면 컴프를 격자로 균등 분할해서
    셀마다 Shape Layer를 하나씩 만듭니다 (간격/여백 0).

  모드:
    맞춤(Fit)  : 도형의 가로/세로 끝이 컴프 가장자리에 정확히 닿음
    덮기(Cover): 도형을 키워서 컴프 사각형 전체가 도형 안에 들어오도록 함
                 (원, 삼각형 등 모서리가 비는 도형도 여백 없이 채움)
*/

(function (thisObj) {

    var SCRIPT_NAME = "Fill Comp Shape";

    var SHAPES = [
        { label: "사각형 (Rectangle)",        id: "rect" },
        { label: "둥근 사각형 (Rounded Rect)", id: "roundrect" },
        { label: "원 / 타원 (Ellipse)",       id: "ellipse" },
        { label: "삼각형 (Triangle)",          id: "triangle" },
        { label: "마름모 (Diamond)",           id: "diamond" },
        { label: "평행사변형 (Parallelogram)", id: "parallelogram" },
        { label: "오각형 (Pentagon)",          id: "pentagon" },
        { label: "육각형 (Hexagon)",           id: "hexagon" },
        { label: "팔각형 (Octagon)",           id: "octagon" },
        { label: "다각형 (N-gon)",             id: "polygon" },
        { label: "별 5각 (Star)",              id: "star5" },
        { label: "별 N각 (N-Star)",            id: "starN" },
        { label: "십자 (Cross)",               id: "cross" }
    ];

    // ------------------------------------------------------------
    // 도형 좌표 계산 (단위 좌표: bbox가 [-1,1] x [-1,1]에 꼭 맞도록 정규화)
    // AE 좌표계는 y가 아래쪽 방향
    // ------------------------------------------------------------
    function regPoly(n, startDeg) {
        var pts = [], i, a;
        for (i = 0; i < n; i++) {
            a = (startDeg + i * 360 / n) * Math.PI / 180;
            pts.push([Math.cos(a), Math.sin(a)]);
        }
        return pts;
    }

    function starPts(n, inner, startDeg) {
        var pts = [], i, a, r;
        for (i = 0; i < n * 2; i++) {
            a = (startDeg + i * 180 / n) * Math.PI / 180;
            r = (i % 2 === 0) ? 1 : inner;
            pts.push([Math.cos(a) * r, Math.sin(a) * r]);
        }
        return pts;
    }

    function normalizeBBox(pts) {
        var minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9, i;
        for (i = 0; i < pts.length; i++) {
            if (pts[i][0] < minX) minX = pts[i][0];
            if (pts[i][0] > maxX) maxX = pts[i][0];
            if (pts[i][1] < minY) minY = pts[i][1];
            if (pts[i][1] > maxY) maxY = pts[i][1];
        }
        var cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
        var hx = (maxX - minX) / 2, hy = (maxY - minY) / 2;
        var out = [];
        for (i = 0; i < pts.length; i++) {
            out.push([(pts[i][0] - cx) / hx, (pts[i][1] - cy) / hy]);
        }
        return out;
    }

    function unitPoints(id, opts) {
        var pts = [];
        switch (id) {
            case "triangle":      pts = [[0, -1], [1, 1], [-1, 1]]; break;
            case "diamond":       pts = [[0, -1], [1, 0], [0, 1], [-1, 0]]; break;
            case "parallelogram": pts = [[-0.6, -1], [1, -1], [0.6, 1], [-1, 1]]; break;
            case "pentagon":      pts = regPoly(5, -90); break;
            case "hexagon":       pts = regPoly(6, 0); break;
            case "octagon":       pts = regPoly(8, 22.5); break;
            case "polygon":       pts = regPoly(opts.n, -90); break;
            case "star5":         pts = starPts(5, opts.inner, -90); break;
            case "starN":         pts = starPts(opts.n, opts.inner, -90); break;
            case "cross":
                var t = 1 / 3;
                pts = [[-t, -1], [t, -1], [t, -t], [1, -t], [1, t], [t, t],
                       [t, 1], [-t, 1], [-t, t], [-1, t], [-1, -t], [-t, -t]];
                break;
        }
        return normalizeBBox(pts);
    }

    // 픽셀 단위 폴리곤 (Cover 계산용). A, B = 도형의 반 너비/반 높이
    function pixelPolygon(id, A, B, opts) {
        var pts = [], i, k, a, r, cx, cy, u;

        if (id === "ellipse") {
            for (i = 0; i < 240; i++) {
                a = i * 2 * Math.PI / 240;
                pts.push([Math.cos(a) * A, Math.sin(a) * B]);
            }
            return pts;
        }

        if (id === "roundrect") {
            r = Math.min(opts.radius, A, B);
            var centers = [[A - r, -(B - r), -90], [A - r, B - r, 0],
                           [-(A - r), B - r, 90], [-(A - r), -(B - r), 180]];
            for (k = 0; k < 4; k++) {
                for (i = 0; i <= 24; i++) {
                    a = (centers[k][2] + i * 90 / 24) * Math.PI / 180;
                    pts.push([centers[k][0] + Math.cos(a) * r, centers[k][1] + Math.sin(a) * r]);
                }
            }
            return pts;
        }

        u = unitPoints(id, opts);
        for (i = 0; i < u.length; i++) pts.push([u[i][0] * A, u[i][1] * B]);
        return pts;
    }

    function pointInPoly(x, y, poly) {
        var inside = false, i, j = poly.length - 1;
        for (i = 0; i < poly.length; i++) {
            var xi = poly[i][0], yi = poly[i][1], xj = poly[j][0], yj = poly[j][1];
            if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
            j = i;
        }
        return inside;
    }

    function coversComp(id, k, w, h, opts) {
        var poly = pixelPolygon(id, k * w / 2, k * h / 2, opts);
        var hw = w / 2 + 1, hh = h / 2 + 1; // 1px 안전 여유
        var steps = 48, i, t;
        for (i = 0; i <= steps; i++) {
            t = -1 + 2 * i / steps;
            if (!pointInPoly(t * hw, -hh, poly)) return false;
            if (!pointInPoly(t * hw, hh, poly)) return false;
            if (!pointInPoly(-hw, t * hh, poly)) return false;
            if (!pointInPoly(hw, t * hh, poly)) return false;
        }
        return true;
    }

    function coverScale(id, w, h, opts) {
        if (id === "rect") return 1;
        var key = [id, w, h, opts.n, opts.inner, opts.radius].join("|");
        if (coverCache[key] !== undefined) return coverCache[key];
        var lo = 1, hi = 40, i, mid;
        for (i = 0; i < 28; i++) {
            mid = (lo + hi) / 2;
            if (coversComp(id, mid, w, h, opts)) hi = mid; else lo = mid;
        }
        coverCache[key] = hi;
        return hi;
    }
    var coverCache = {};

    // ------------------------------------------------------------
    // Shape Layer 생성
    // ------------------------------------------------------------
    function randomColor() {
        var h = Math.random() * 6, s = 0.6, v = 0.95;
        var i = Math.floor(h), f = h - i;
        var p = v * (1 - s), q = v * (1 - s * f), t = v * (1 - s * (1 - f));
        switch (i % 6) {
            case 0: return [v, t, p];
            case 1: return [q, v, p];
            case 2: return [p, v, t];
            case 3: return [p, q, v];
            case 4: return [t, p, v];
            default: return [v, p, q];
        }
    }

    // cw, ch : 타일(셀) 크기 / cx, cy : 셀 중심 좌표 / k : Cover 배율
    function createShapeLayer(comp, shapeDef, opts, k, cw, ch, cx, cy, name, color) {
        var id = shapeDef.id;
        var A = k * cw / 2, B = k * ch / 2;

        var layer = comp.layers.addShape();
        layer.name = name;

        var root = layer.property("ADBE Root Vectors Group");
        var group = root.addProperty("ADBE Vector Group");
        group.name = "Shape";
        var contents = group.property("ADBE Vectors Group");

        if (id === "rect") {
            var rc = contents.addProperty("ADBE Vector Shape - Rect");
            rc.property("ADBE Vector Rect Size").setValue([A * 2, B * 2]);
        } else if (id === "roundrect") {
            var rr = contents.addProperty("ADBE Vector Shape - Rect");
            rr.property("ADBE Vector Rect Size").setValue([A * 2, B * 2]);
            rr.property("ADBE Vector Rect Roundness").setValue(Math.min(opts.radius, A, B));
        } else if (id === "ellipse") {
            var el = contents.addProperty("ADBE Vector Shape - Ellipse");
            el.property("ADBE Vector Ellipse Size").setValue([A * 2, B * 2]);
        } else {
            var u = unitPoints(id, opts);
            var verts = [], zeros = [], i;
            for (i = 0; i < u.length; i++) {
                verts.push([u[i][0] * A, u[i][1] * B]);
                zeros.push([0, 0]);
            }
            var shp = new Shape();
            shp.vertices = verts;
            shp.inTangents = zeros;
            shp.outTangents = zeros;
            shp.closed = true;
            var path = contents.addProperty("ADBE Vector Shape - Group");
            path.property("ADBE Vector Shape").setValue(shp);
        }

        var fill = contents.addProperty("ADBE Vector Graphic - Fill");
        fill.property("ADBE Vector Fill Color").setValue(color);

        // 레이어를 셀 중앙에 배치
        var tr = layer.property("ADBE Transform Group");
        tr.property("ADBE Anchor Point").setValue([0, 0]);
        tr.property("ADBE Position").setValue([cx, cy]);

        if (opts.sendToBack) layer.moveToEnd();
        layer.selected = true;
        return layer;
    }

    // ------------------------------------------------------------
    // UI
    // ------------------------------------------------------------
    function buildUI(thisObj) {
        var win = (thisObj instanceof Panel)
            ? thisObj
            : new Window("palette", SCRIPT_NAME, undefined, { resizeable: true });

        win.orientation = "column";
        win.alignChildren = ["fill", "top"];
        win.margins = 12;
        win.spacing = 8;

        var fillColor = [1, 1, 1];

        // 도형 선택
        var rowShape = win.add("group");
        rowShape.alignChildren = ["left", "center"];
        rowShape.add("statictext", undefined, "도형:");
        var labels = [], i;
        for (i = 0; i < SHAPES.length; i++) labels.push(SHAPES[i].label);
        var dd = rowShape.add("dropdownlist", undefined, labels);
        dd.alignment = ["fill", "center"];
        dd.selection = 0;

        // 옵션 패널
        var pnl = win.add("panel", undefined, "도형 옵션");
        pnl.alignChildren = ["fill", "top"];
        pnl.margins = [10, 14, 10, 10];

        function addRow(parent, text, def) {
            var g = parent.add("group");
            g.alignChildren = ["left", "center"];
            var st = g.add("statictext", undefined, text);
            st.preferredSize.width = 120;
            var et = g.add("edittext", undefined, def);
            et.preferredSize.width = 60;
            return et;
        }
        var nEdit = addRow(pnl, "꼭짓점 개수 (N):", "6");
        var innerEdit = addRow(pnl, "별 안쪽 비율 (%):", "50");
        var radiusEdit = addRow(pnl, "모서리 반경 (px):", "100");

        // 개수 (격자)
        var pnlCount = win.add("panel", undefined, "개수 (격자로 빈틈없이 배치)");
        pnlCount.alignChildren = ["fill", "top"];
        pnlCount.margins = [10, 14, 10, 10];
        var colsEdit = addRow(pnlCount, "가로 개수:", "1");
        var rowsEdit = addRow(pnlCount, "세로 개수:", "1");
        var totalTxt = pnlCount.add("statictext", undefined, "총 1개 레이어");
        var compTxt = pnlCount.add("statictext", undefined, "컴프: -");
        var cellTxt = pnlCount.add("statictext", undefined, "셀 크기: -");
        var shapeTxt = pnlCount.add("statictext", undefined, "도형 크기: -");
        var noteTxt = pnlCount.add("statictext", undefined, "");
        totalTxt.preferredSize.width = compTxt.preferredSize.width =
            cellTxt.preferredSize.width = shapeTxt.preferredSize.width =
            noteTxt.preferredSize.width = 260;
        var refreshBtn = pnlCount.add("button", undefined, "컴프 크기 새로고침");

        // 모드
        var pnlMode = win.add("panel", undefined, "채우기 방식");
        pnlMode.orientation = "row";
        pnlMode.alignChildren = ["left", "center"];
        pnlMode.margins = [10, 14, 10, 10];
        var rbFit = pnlMode.add("radiobutton", undefined, "맞춤 (Fit)");
        var rbCover = pnlMode.add("radiobutton", undefined, "덮기 (Cover)");
        rbCover.value = true;

        // 기타 옵션
        var cbBack = win.add("checkbox", undefined, "레이어를 맨 아래로 보내기");
        cbBack.value = true;
        var cbRandom = win.add("checkbox", undefined, "타일마다 랜덤 색상");
        cbRandom.value = false;

        // 색상
        var rowColor = win.add("group");
        rowColor.alignChildren = ["left", "center"];
        rowColor.add("statictext", undefined, "색상:");
        var colorBtn = rowColor.add("button", undefined, "");
        colorBtn.preferredSize = [60, 22];
        colorBtn.onDraw = function () {
            var gr = this.graphics;
            var br = gr.newBrush(gr.BrushType.SOLID_COLOR, [fillColor[0], fillColor[1], fillColor[2], 1]);
            gr.rectPath(0, 0, this.size[0], this.size[1]);
            gr.fillPath(br);
        };
        colorBtn.onClick = function () {
            var c = $.colorPicker();
            if (c >= 0) {
                fillColor = [(c >> 16) / 255, ((c >> 8) & 255) / 255, (c & 255) / 255];
                colorBtn.visible = false;
                colorBtn.visible = true;
            }
        };

        // 생성 버튼
        var btn = win.add("button", undefined, "Shape Layer 생성");

        function updateEnabled() {
            var id = SHAPES[dd.selection.index].id;
            nEdit.enabled = (id === "polygon" || id === "starN");
            innerEdit.enabled = (id === "star5" || id === "starN");
            radiusEdit.enabled = (id === "roundrect");
        }
        // ---- 실시간 픽셀 크기 표시 ----
        function parseCount(edit) {
            var v = Math.round(parseFloat(edit.text));
            if (isNaN(v) || v < 1) v = 1;
            if (v > 100) v = 100;
            return v;
        }
        function fmt(v) { return String(Math.round(v * 100) / 100); }

        function updateInfo() {
            try {
                var c = parseCount(colsEdit), r = parseCount(rowsEdit);
                totalTxt.text = "총 " + (c * r) + "개 레이어";

                var comp = app.project.activeItem;
                if (!(comp instanceof CompItem)) {
                    compTxt.text = "컴프: (활성 컴포지션 없음)";
                    cellTxt.text = "셀 크기: -";
                    shapeTxt.text = "도형 크기: -";
                    noteTxt.text = "";
                    return;
                }

                var n = Math.round(parseFloat(nEdit.text));
                if (isNaN(n) || n < 3) n = 3;
                if (n > 100) n = 100;
                var inner = parseFloat(innerEdit.text) / 100;
                if (isNaN(inner) || inner <= 0.01) inner = 0.01;
                if (inner > 0.99) inner = 0.99;
                var radius = parseFloat(radiusEdit.text);
                if (isNaN(radius) || radius < 0) radius = 0;
                var o = { n: n, inner: inner, radius: radius };

                var cw = comp.width / c, ch = comp.height / r;
                var def = SHAPES[dd.selection.index];
                var cover = rbCover.value;
                var k = cover ? coverScale(def.id, cw, ch, o) : 1;

                compTxt.text = "컴프: " + comp.width + " × " + comp.height + " px";
                cellTxt.text = "셀 크기: " + fmt(cw) + " × " + fmt(ch) + " px  (" + c + " × " + r + ")";
                shapeTxt.text = "도형 크기: " + fmt(cw * k) + " × " + fmt(ch * k) + " px" +
                    (cover && k > 1.0001 ? "  (×" + (Math.round(k * 1000) / 1000) + ")" : "");

                var notes = [];
                if (comp.width % c !== 0 || comp.height % r !== 0) {
                    notes.push("※ 나누어떨어지지 않아 소수점 픽셀 발생");
                }
                if (cover && k > 1.0001) {
                    notes.push("※ 덮기 모드: 도형이 셀보다 커서 서로 겹침");
                }
                noteTxt.text = notes.join("\n");
                noteTxt.size = [260, notes.length * 16 + 2];
            } catch (e) {}
        }

        colsEdit.onChanging = updateInfo;
        rowsEdit.onChanging = updateInfo;
        nEdit.onChanging = updateInfo;
        innerEdit.onChanging = updateInfo;
        radiusEdit.onChanging = updateInfo;
        rbFit.onClick = updateInfo;
        rbCover.onClick = updateInfo;
        refreshBtn.onClick = updateInfo;
        win.onActivate = updateInfo;

        dd.onChange = function () { updateEnabled(); updateInfo(); };
        updateEnabled();
        updateInfo();

        btn.onClick = function () {
            var comp = app.project.activeItem;
            if (!(comp instanceof CompItem)) {
                alert("컴포지션을 먼저 열고(활성화) 다시 실행해 주세요.");
                return;
            }

            var n = Math.round(parseFloat(nEdit.text));
            var inner = parseFloat(innerEdit.text) / 100;
            var radius = parseFloat(radiusEdit.text);
            if (isNaN(n) || n < 3) n = 3;
            if (n > 100) n = 100;
            if (isNaN(inner) || inner <= 0.01) inner = 0.01;
            if (inner > 0.99) inner = 0.99;
            if (isNaN(radius) || radius < 0) radius = 0;

            var cols = Math.round(parseFloat(colsEdit.text));
            var rows = Math.round(parseFloat(rowsEdit.text));
            if (isNaN(cols) || cols < 1) cols = 1;
            if (isNaN(rows) || rows < 1) rows = 1;
            if (cols > 100) cols = 100;
            if (rows > 100) rows = 100;
            if (cols * rows > 200 &&
                !confirm(cols * rows + "개의 레이어를 만듭니다. 계속할까요?")) {
                return;
            }

            var opts = {
                n: n,
                inner: inner,
                radius: radius,
                mode: rbCover.value ? "cover" : "fit",
                color: fillColor,
                sendToBack: cbBack.value
            };

            app.beginUndoGroup(SCRIPT_NAME);
            try {
                var shapeDef = SHAPES[dd.selection.index];
                var cw = comp.width / cols, ch = comp.height / rows;
                var baseName = shapeDef.label.split(" (")[0] + " Fill";

                // Cover 배율은 셀 크기 기준으로 한 번만 계산
                var k = (opts.mode === "cover") ? coverScale(shapeDef.id, cw, ch, opts) : 1;

                // 기존 선택 해제 (새로 만든 레이어만 선택되도록)
                var prevSel = comp.selectedLayers, s, r, c;
                for (s = 0; s < prevSel.length; s++) prevSel[s].selected = false;

                for (r = 0; r < rows; r++) {
                    for (c = 0; c < cols; c++) {
                        var name = (cols * rows === 1)
                            ? baseName
                            : baseName + " r" + (r + 1) + "c" + (c + 1);
                        var color = cbRandom.value ? randomColor() : fillColor;
                        createShapeLayer(comp, shapeDef, opts, k, cw, ch,
                                         cw * (c + 0.5), ch * (r + 0.5), name, color);
                    }
                }
            } catch (e) {
                alert("오류: " + e.toString() + "\n(줄 " + e.line + ")");
            }
            app.endUndoGroup();
        };

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

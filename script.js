let oldValue = "";
function clearValue(element) {
    oldValue = element.value; // Lưu lại giá trị hiện tại
    element.value = "";       // Xóa trắng ô input để ẩn giá trị đi
}
function restoreValue(element) {
    // Nếu người dùng bỏ chọn và không nhập gì, khôi phục lại giá trị cũ
    if (element.value === "") {
        element.value = oldValue;
    }
}

function setMode(mode) {
    localStorage.setItem('simplex_mode', mode);
    currentMode = mode;
    document.getElementById('tab-standard').classList.remove('active');
    document.getElementById('tab-bigm').classList.remove('active');
    document.getElementById('tab-dual').classList.remove('active');
    document.getElementById(`tab-${mode}`).classList.add('active');
    document.getElementById('outputArea').innerHTML = '';
    generateInputGrid(); 
}

// --- 1. CÁC LỚP XỬ LÝ TOÁN HỌC ---
class Frac {
    constructor(n, d = 1) {
        if (d === 0) throw "Lỗi chia cho 0";
        let sign = (n * d < 0) ? -1 : 1;
        n = Math.abs(n); d = Math.abs(d);
        let g = this.gcd(n, d);
        this.n = sign * (n / g);
        this.d = d / g;
    }
    gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { let t = b; b = a % b; a = t; } return a; }
    add(f) { return new Frac(this.n * f.d + f.n * this.d, this.d * f.d); }
    sub(f) { return new Frac(this.n * f.d - f.n * this.d, this.d * f.d); }
    mul(f) { return new Frac(this.n * f.n, this.d * f.d); }
    div(f) { return new Frac(this.n * f.d, this.d * f.n); }
    neg() { return new Frac(-this.n, this.d); }
    cmp(f) { return this.n * f.d - f.n * this.d; }
    isZero() { return this.n === 0; }
    isNegative() { return this.n < 0; }
    isPositive() { return this.n > 0; }
    toString() { return this.d === 1 ? `${this.n}` : `${this.n}/${this.d}`; }
}

class BigMFrac {
    constructor(m, r) {
        this.m = m; 
        this.r = r; 
    }
    add(o) { return new BigMFrac(this.m.add(o.m), this.r.add(o.r)); }
    sub(o) { return new BigMFrac(this.m.sub(o.m), this.r.sub(o.r)); }
    mulFrac(f) { return new BigMFrac(this.m.mul(f), this.r.mul(f)); }
    divFrac(f) { return new BigMFrac(this.m.div(f), this.r.div(f)); }
    neg() { return new BigMFrac(this.m.neg(), this.r.neg()); }
    
    cmp(o) {
        let mCmp = this.m.cmp(o.m);
        if (mCmp !== 0) return mCmp;
        return this.r.cmp(o.r);
    }
    isNegative() {
        if (this.m.isNegative()) return true;
        if (this.m.isZero() && this.r.isNegative()) return true;
        return false;
    }
    isZero() { return this.m.isZero() && this.r.isZero(); }
    isPositive() {
        if (this.m.isPositive()) return true;
        if (this.m.isZero() && this.r.isPositive()) return true;
        return false;
    }
}

function parseFrac(str) {
    str = str.toString().trim();
    if (!str) return new Frac(0);
    if (str.includes('/')) {
        let p = str.split('/');
        return new Frac(parseInt(p[0]), parseInt(p[1]));
    }
    if (str.includes('.')) {
        let p = str.split('.');
        let dec = p[1];
        let num = parseInt(p[0] + dec);
        let den = Math.pow(10, dec.length);
        return new Frac(num, den);
    }
    return new Frac(parseInt(str));
}

function toBigM(val) {
    if (val instanceof BigMFrac) return val;
    return new BigMFrac(new Frac(0), val);
}

function addVal(x, y) {
    if (x instanceof BigMFrac || y instanceof BigMFrac) return toBigM(x).add(toBigM(y));
    return x.add(y);
}

function subVal(x, y) {
    if (x instanceof BigMFrac || y instanceof BigMFrac) return toBigM(x).sub(toBigM(y));
    return x.sub(y);
}

function mulVal(x, y) {
    if (x instanceof BigMFrac && y instanceof BigMFrac) {
        if (x.m.isZero()) return y.mulFrac(x.r);
        if (y.m.isZero()) return x.mulFrac(y.r);
        return new BigMFrac(x.m.mul(y.r).add(x.r.mul(y.m)), x.r.mul(y.r));
    }
    if (x instanceof BigMFrac) return x.mulFrac(y);
    if (y instanceof BigMFrac) return y.mulFrac(x);
    return x.mul(y);
}

function divVal(x, y) {
    if (x instanceof BigMFrac && y instanceof BigMFrac) return x.divFrac(y.r); 
    if (x instanceof BigMFrac) return x.divFrac(y);
    if (y instanceof BigMFrac) return toBigM(x).divFrac(y.r);
    return x.div(y);
}

function cmpVal(x, y) {
    if (x instanceof BigMFrac || y instanceof BigMFrac) return toBigM(x).cmp(toBigM(y));
    return x.cmp(y);
}

function isNegativeVal(x) { return x.isNegative(); }
function isZeroVal(x) { return x.isZero(); }
function isPositiveVal(x) { return x.isPositive(); }
function negVal(x) { return x.neg(); }

function isBigMMode() {
    return currentMode === 'bigm' || currentMode === 'dual';
}

function getDualRatio(c, a) {
    // Tính -c_j / a_ij
    return divVal(c, a);
}

function formatBigMFracSingleLine(bm) {
    if (!bm) return "";
    if (!(bm instanceof BigMFrac)) return bm.toString();
    
    let mPart = bm.m;
    let rPart = bm.r;
    
    if (mPart.isZero() && rPart.isZero()) return "0";
    
    let mStr = "";
    if (!mPart.isZero()) {
        if (mPart.n === 1 && mPart.d === 1) mStr = "M";
        else if (mPart.n === -1 && mPart.d === 1) mStr = "-M";
        else mStr = mPart.toString() + "M";
    }
    
    let rStr = "";
    if (!rPart.isZero()) rStr = rPart.toString();
    
    if (mStr && rStr) {
        if (mPart.isPositive()) return rStr + "+" + mStr;
        else return rStr + mStr;       
    }
    return mStr || rStr;
}

// --- 2. GIAO DIỆN NHẬP LIỆU ---
function toggleArtificial(i) {
    let cb = document.getElementById(`chk_art_${i}`);
    let bVar = document.getElementById(`bVar_${i}`);
    let bVal = document.getElementById(`val_b_${i}`);
    
    if (cb.checked) {
        bVar.value = `v${i+1}`;
        if (currentMode === 'dual') {
            bVal.value = "M";
            bVal.disabled = true;
            bVal.style.backgroundColor = "#fff";
            bVal.style.fontWeight = "bold";
            bVal.style.color = "#333";

            // Ẩn các checkbox khác khi đang ở chế độ Dual
            document.querySelectorAll('.artificial-cb').forEach(item => {
                if (item !== cb) {
                    item.disabled = true;
                    item.style.pointerEvents = 'none';
                    item.parentElement.style.opacity = '0.5'; // Làm mờ chữ và checkbox
                    item.parentElement.style.cursor = 'not-allowed'; // Đổi con trỏ chuột
                }
            });
        }
    } else {
        bVar.value = `w${i+1}`;
        if (currentMode === 'dual') {
            bVal.value = "";
            bVal.disabled = false;
            bVal.style.backgroundColor = "";
            bVal.style.fontWeight = "";
            bVal.style.color = "";

            // Hiện lại tất cả checkbox khi bỏ ẩn giả ở chế độ Dual
            document.querySelectorAll('.artificial-cb').forEach(item => {
                item.disabled = false;
                item.style.pointerEvents = 'auto';
                item.parentElement.style.opacity = '1'; 
                item.parentElement.style.cursor = 'pointer';
            });
        }
    }
}

function sanitizeInput(el) {
    if (currentMode === 'dual' && el.value === 'M') return;
    el.value = el.value.replace(/[^0-9\.\-\/M]/g, '');
}

function generateInputGrid() {
    let rInput = document.getElementById('numRows');
    let cInput = document.getElementById('numCols');
    
    let rows = parseInt(rInput.value);
    let cols = parseInt(cInput.value);
    if (isNaN(rows) || rows < 1) rows = 1;
    if (isNaN(cols) || cols < 1) cols = 1;
    
    rInput.value = rows;
    cInput.value = cols;
    
    localStorage.setItem('simplex_rows', rows);
    localStorage.setItem('simplex_cols', cols);

    const inputValidation = `oninput="sanitizeInput(this)" onfocus="clearValue(this)"`;
    let html = '<table class="simplex-table">';
    
    if (currentMode === 'standard' || currentMode === 'dual') {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=1; j<=cols; j++) html += `<th><input type="text" id="nbVar_${j-1}" value="x${j}" class="input-cell title" style="font-style:italic; font-weight:bold;"></th>`;
        html += `</tr><tr>`;
        html += `<th colspan="2"><input type="text" id="val_f" placeholder="0" value="" class="input-cell title" ${inputValidation}></th>`;
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        html += `</tr>`;
    } else if (currentMode === 'bigm') {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=1; j<=cols; j++) html += `<th><input type="text" id="nbVar_${j-1}" value="x${j}" class="input-cell title" style="font-style:italic; font-weight:bold;"></th>`;
        html += `</tr><tr><th colspan="2" style="white-space:nowrap;"><input type="text" id="val_f_m" placeholder="0" value="" class="input-cell title" ${inputValidation}> <strong>M</strong></th>`;
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_m_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}><strong>M</strong></td>`;
        html += `</tr><tr><th colspan="2"><input type="text" id="val_f_r" placeholder="0" value="" class="input-cell title" ${inputValidation}></th>`;
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_r_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        html += `</tr>`;
    }

    for(let i=1; i<=rows; i++) {
        let bVarTpl = `<input type="text" id="bVar_${i-1}" value="w${i}" class="input-cell title" style="font-style:italic; font-weight:bold;">`;
        
        // Không dùng <br>, cấu trúc HTML cố định, CSS sẽ tự động đổi chỗ và rớt dòng
        if (currentMode === 'bigm' || currentMode === 'dual') {
            bVarTpl += `<label class="artificial-label"><input type="checkbox" id="chk_art_${i-1}" class="artificial-cb" onchange="toggleArtificial(${i-1})"> <span style="font-size: 0.9em;">Ẩn giả</span></label>`;
        }

        html += `<tr><th style="position: relative;">${bVarTpl}</th>`;
        html += `<td><input type="text" id="val_b_${i-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        for(let j=1; j<=cols; j++) {
            html += `<td><input type="text" id="val_A_${i-1}_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        }
        html += `</tr>`;
    }
    html += `</table>`;
    
    document.getElementById('inputGridContainer').innerHTML = html;
    document.getElementById('controls').style.display = 'flex';
    document.getElementById('outputArea').innerHTML = '';
}

// --- 3. THUẬT TOÁN CỐT LÕI VÀ HIỂN THỊ ---
function startSolving(pushToHistory = true) {
    const output = document.getElementById('outputArea');
    output.innerHTML = '<h2>Quá trình giải</h2>';
    const numRows = parseInt(document.getElementById('numRows').value);
    const numCols = parseInt(document.getElementById('numCols').value);

    // -- LƯU LỊCH SỬ TRÌNH DUYỆT --
    if (pushToHistory) {
        let state = getProblemState();
        let encoded = btoa(encodeURIComponent(JSON.stringify(state)));
        let newUrl = window.location.origin + window.location.pathname + "?data=" + encoded;
        // Đẩy vào lịch sử duyệt web
        window.history.pushState({ stateData: state }, '', newUrl);
    }
    
    let T = { basicVars: [], nonBasicVars: [], c: [], b: [], A: [], f: null };

    if (currentMode === 'dual') {
        let fReal = parseFrac(document.getElementById('val_f').value);
        T.f = new BigMFrac(new Frac(0), fReal);
        
        for(let j=0; j<numCols; j++) {
            T.nonBasicVars.push(document.getElementById(`nbVar_${j}`).value);
            let cReal = parseFrac(document.getElementById(`val_c_${j}`).value);
            T.c.push(new BigMFrac(new Frac(0), cReal));
        }

        for(let i=0; i<numRows; i++) {
            T.basicVars.push(document.getElementById(`bVar_${i}`).value);
            
            let cb = document.getElementById(`chk_art_${i}`);
            if (cb && cb.checked) {
                T.b.push(new BigMFrac(new Frac(1), new Frac(0)));
            } else {
                let bReal = parseFrac(document.getElementById(`val_b_${i}`).value);
                T.b.push(new BigMFrac(new Frac(0), bReal)); 
            }

            let rowA = [];
            for(let j=0; j<numCols; j++) {
                rowA.push(parseFrac(document.getElementById(`val_A_${i}_${j}`).value));
            }
            T.A.push(rowA);
        }
    } else {
        if (currentMode === 'standard') {
            T.f = parseFrac(document.getElementById('val_f').value);
        } else {
            T.f = new BigMFrac(parseFrac(document.getElementById('val_f_m').value), parseFrac(document.getElementById('val_f_r').value));
        }

        for(let j=0; j<numCols; j++) {
            T.nonBasicVars.push(document.getElementById(`nbVar_${j}`).value);
            if (currentMode === 'standard') {
                T.c.push(parseFrac(document.getElementById(`val_c_${j}`).value));
            } else {
                T.c.push(new BigMFrac(parseFrac(document.getElementById(`val_c_m_${j}`).value), parseFrac(document.getElementById(`val_c_r_${j}`).value)));
            }
        }

        for(let i=0; i<numRows; i++) {
            T.basicVars.push(document.getElementById(`bVar_${i}`).value);
            T.b.push(parseFrac(document.getElementById(`val_b_${i}`).value));
            let rowA = [];
            for(let j=0; j<numCols; j++) {
                rowA.push(parseFrac(document.getElementById(`val_A_${i}_${j}`).value));
            }
            T.A.push(rowA);
        }
    }

    // --- ĐỐI VỚI CHẾ ĐỘ ĐƠN HÌNH ĐỐI NGẪU (DUAL) ---
    if (currentMode === 'dual') {
        let iteration = 0;
        const maxIter = 20;
        T.droppedRows = []; 

        while(iteration < maxIter) {
            let pRow = -1;
            let pCol = -1;

            let artRowsInBasis = [];
            for (let i = 0; i < T.basicVars.length; i++) {
                if (T.basicVars[i].startsWith('v') && !T.droppedRows.includes(i)) {
                    artRowsInBasis.push(i);
                }
            }

            if (artRowsInBasis.length > 0) {
                // --- GIAI ĐOẠN A: CÓ ẨN GIẢ TRONG CƠ SỞ ---
                for (let r of artRowsInBasis) {
                    let validCols = [];
                    for (let j = 0; j < T.nonBasicVars.length; j++) {
                        // Chọn phần tử xoay bắt buộc a_ij > 0
                        if (T.A[r][j] !== null && isPositiveVal(T.A[r][j])) {
                            validCols.push(j);
                        }
                    }

                    if (validCols.length > 0) {
                        pRow = r;
                        let minRatio = null;
                        for (let j of validCols) {
                            let ratio = getDualRatio(T.c[j], T.A[r][j]);
                            // Chọn cột có tỷ số nhỏ nhất
                            if (minRatio === null || cmpVal(ratio, minRatio) < 0) {
                                minRatio = ratio;
                                pCol = j;
                            }
                        }
                        if (pRow !== -1 && pCol !== -1) break; 
                    }
                }
            }

            if (pRow === -1) {
                // --- GIAI ĐOẠN B: KHÔNG CÒN ẨN GIẢ TRONG CƠ SỞ ---
                let minB = new Frac(0);
                for (let i = 0; i < T.basicVars.length; i++) {
                    if (T.droppedRows.includes(i)) continue;
                    if (isNegativeVal(T.b[i]) && cmpVal(T.b[i], minB) < 0) {
                        minB = T.b[i];
                        pRow = i;
                    }
                }

                if (pRow !== -1) {
                    let validCols = [];
                    for (let j = 0; j < T.nonBasicVars.length; j++) {
                        // Chọn phần tử xoay bắt buộc a_ij < 0
                        if (T.A[pRow][j] !== null && isNegativeVal(T.A[pRow][j])) {
                            validCols.push(j);
                        }
                    }

                    if (validCols.length === 0) {
                        renderTableau(T, iteration, -1, -1);
                        output.innerHTML += '<div class="status-infeasible">Tồn tại hàng xoay chứa các hệ số không âm. Hàm mục tiêu bài toán (P<sup>a</sup>) không bị chặn (Bài toán (P) VÔ NGHIỆM).</div>';   // Đơn hình đối ngẫu
                        break;
                    }

                    let maxRatio = null;
                    for (let j of validCols) {
                        let ratio = getDualRatio(T.c[j], T.A[pRow][j]);
                        // Chọn cột có tỷ số LỚN nhất
                        if (maxRatio === null || cmpVal(ratio, maxRatio) > 0) {
                            maxRatio = ratio;
                            pCol = j;
                        }
                    }
                }
            }

            // --- KIỂM TRA ĐIỀU KIỆN DỪNG ---
            if (pRow === -1) {
                let dualFeasible = true;
                for (let j = 0; j < T.c.length; j++) {
                    if (T.c[j] !== null && isNegativeVal(T.c[j])) {
                        dualFeasible = false;
                        break;
                    }
                }

                renderTableau(T, iteration, -1, -1);

                if (dualFeasible) {
                    let hasZeroDelta = false;
                    for(let j=0; j<T.c.length; j++) {
                        if (T.c[j] !== null && isZeroVal(T.c[j])) {
                            hasZeroDelta = true;
                            break;
                        }
                    }

                    let hasNonBasicArtificial = T.nonBasicVars.some(v => v.startsWith('v'));
                    let hasArtificialInInitial = false;
                    for (let i = 0; i < numRows; i++) {
                        let cb = document.getElementById(`chk_art_${i}`);
                        if (cb && cb.checked) {
                            hasArtificialInInitial = true;
                            break;
                        }
                    }
                    if (hasZeroDelta) {
                        output.innerHTML += '<div class="status-optimal">Cơ sở gốc khả dĩ và đối ngẫu khả dĩ. Tồn tại biến ngoài cơ sở có hệ số bằng 0. Bài toán (P<sup>a</sup>) có VÔ SỐ nghiệm tối ưu.</div>';   // Đơn hình đối ngẫu
                    } else {
                        if (hasArtificialInInitial && hasNonBasicArtificial) {
                            output.innerHTML += '<div class="status-unbounded">Cơ sở gốc khả dĩ và đối ngẫu khả dĩ nhưng ẩn giả ngoài cơ sở. Hàm mục tiêu bài toán (P) không bị chặn.</div>';   // Đơn hình đối ngẫu
                        } else {
                            output.innerHTML += '<div class="status-optimal">Cơ sở gốc khả dĩ và đối ngẫu khả dĩ. Kết luận nghiệm tối ưu của bài toán.</div>';   // Đơn hình đối ngẫu
                        }
                    }
                } else {
                    output.innerHTML += '<div class="status-optimal">Cơ sở gốc khả dĩ nhưng KHÔNG đối ngẫu khả dĩ. Bảng đơn hình dừng lại.</div>';   // Đơn hình đối ngẫu
                }
                break;
            }

            renderTableau(T, iteration, pRow, pCol);
            T = pivot(T, pRow, pCol);
            
            // LOGIC GẠCH BỎ HÀNG: Nếu ẩn giả vừa quay trở lại cơ sở, ghi nhận gạch bỏ hàng này để bỏ qua tính toán về sau
            if (T.basicVars[pRow].startsWith('v')) {
                T.droppedRows.push(pRow);
            }
            
            iteration++;
        }
        return; 
    }

    // --- ĐỐI VỚI CHẾ ĐỘ ĐƠN HÌNH GỐC HOẶC BIG-M ---
    let iteration = 0;
    const maxIter = 20;

    while(iteration < maxIter) {
        let pCol = -1;
        let minC = currentMode === 'standard' ? new Frac(0) : new BigMFrac(new Frac(0), new Frac(0));

        for(let j=0; j<T.c.length; j++) {
            if (currentMode === 'bigm' && T.nonBasicVars[j].startsWith('v')) continue; 
            
            if (T.c[j] !== null && isNegativeVal(T.c[j]) && cmpVal(T.c[j], minC) < 0) {
                minC = T.c[j];
                pCol = j;
            }
        }

        if (pCol === -1) {
            renderTableau(T, iteration, -1, -1);
            if (currentMode === 'standard') {
                let hasZeroDelta = false;
                for(let j=0; j<T.c.length; j++) {
                    if (T.c[j] !== null && isZeroVal(T.c[j])) {
                        hasZeroDelta = true;
                        break;
                    }
                }
                if (hasZeroDelta) {
                    output.innerHTML += '<div class="status-optimal">Tồn tại biến ngoài cơ sở có hệ số bằng 0. Bài toán (P) có VÔ SỐ nghiệm tối ưu.</div>';   // Đơn hình gốc
                } else {
                    output.innerHTML += '<div class="status-optimal">Hệ số các biến ngoài cơ sở đều dương. Kết luận nghiệm tối ưu của bài toán.</div>';   // Đơn hình gốc
                }
            } else {
                let hasPositiveArtificial = false;
                for(let i=0; i<T.basicVars.length; i++) {
                    if (T.basicVars[i].startsWith('v') && isPositiveVal(T.b[i])) {
                        hasPositiveArtificial = true;
                        break;
                    }
                }
                let hasZeroDelta = false;
                for(let j=0; j<T.c.length; j++) {
                    if (T.c[j] !== null && isZeroVal(T.c[j])) {
                        hasZeroDelta = true;
                        break;
                    }
                }
                if (hasPositiveArtificial) {
                    output.innerHTML += '<div class="status-infeasible">Hệ số các biến ngoài cơ sở đều dương. Tồn tại ẩn giả dương trong cơ sở. Bài toán (P) VÔ NGHIỆM.</div>';   // Đơn hình Big-M
                } else if (hasZeroDelta) {
                    output.innerHTML += '<div class="status-optimal">Tồn tại biến ngoài cơ sở có hệ số bằng 0. Bài toán (P<sup>a</sup>) có VÔ SỐ nghiệm tối ưu.</div>';   // Đơn hình Big-M
                } else {
                    output.innerHTML += '<div class="status-optimal">Hệ số các biến ngoài cơ sở đều dương. Mọi ẩn giả bằng 0. Kết luận nghiệm tối ưu của bài toán.</div>';   // Đơn hình Big-M
                }
            }
            break;
        }

        let pRow = -1;
        let minRatio = null;
        for(let i=0; i<T.A.length; i++) {
            if (T.A[i][pCol] !== null && T.A[i][pCol].isPositive()) {
                let ratio = divVal(T.b[i], T.A[i][pCol]);
                if (minRatio === null || cmpVal(ratio, minRatio) < 0) {
                    minRatio = ratio;
                    pRow = i;
                }
            }
        }

        if (pRow === -1) {
            renderTableau(T, iteration, -1, pCol);
            if (currentMode === 'standard') {
                output.innerHTML += '<div class="status-unbounded">Tồn tại cột xoay chứa các hệ số không dương. Hàm mục tiêu KHÔNG BỊ CHẶN.</div>';   // Đơn hình gốc
            } else {
                let hasPositiveArtificial = false;
                for(let i=0; i<T.basicVars.length; i++) {
                    if (T.basicVars[i].startsWith('v') && isPositiveVal(T.b[i])) {
                        hasPositiveArtificial = true;
                        break;
                    }
                }
                if (hasPositiveArtificial) {
                    output.innerHTML += '<div class="status-infeasible">Bài toán (P<sup>a</sup>) có hàm mục tiêu KHÔNG BỊ CHẶN. Tồn tại ẩn giả dương trong cơ sở. Bài toán (P) VÔ NGHIỆM.</div>';   // Đơn hình Big-M
                } else {
                    output.innerHTML += '<div class="status-unbounded">Bài toán (P<sup>a</sup>) có hàm mục tiêu KHÔNG BỊ CHẶN. Mọi ẩn giả bằng 0. Bài toán (P) có hàm mục tiêu cũng không bị chặn.</div>';   // Đơn hình Big-M
                }
            }
            break;
        }

        renderTableau(T, iteration, pRow, pCol);
        T = pivot(T, pRow, pCol);
        iteration++;
    }
}

function pivot(T, pRow, pCol) {
    let P = T.A[pRow][pCol];
    let newT = { 
        basicVars: [...T.basicVars], 
        nonBasicVars: [...T.nonBasicVars], 
        A: [], 
        b: [], 
        c: [], 
        f: null,
        droppedRows: T.droppedRows ? [...T.droppedRows] : []
    };
    
    newT.basicVars[pRow] = T.nonBasicVars[pCol];
    newT.nonBasicVars[pCol] = T.basicVars[pRow];

    let invP = new Frac(1).div(P);
    let negP = P.neg();

    for(let i=0; i<T.basicVars.length; i++) newT.A.push([]);

    for(let j=0; j<T.nonBasicVars.length; j++) {
        // Dual: KHÔNG gạch bỏ cột ẩn giả. Chỉ gạch bỏ nếu ở chế độ Big-M
        if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
            newT.A[pRow][j] = null;
        } else if(j === pCol) {
            newT.A[pRow][j] = invP;
        } else {
            newT.A[pRow][j] = mulVal(T.A[pRow][j], invP);
        }
    }
    
    newT.b[pRow] = mulVal(T.b[pRow], invP);

    for(let i=0; i<T.basicVars.length; i++) {
        if(i !== pRow) {
            // Dual: Bỏ qua hoàn toàn việc tính toán ở hàng đã bị gạch bỏ
            if (currentMode === 'dual' && newT.droppedRows.includes(i)) {
                newT.b[i] = null;
                newT.A[i][pCol] = null;
                continue;
            }

            if (currentMode === 'bigm' && newT.nonBasicVars[pCol].startsWith('v')) {
                newT.A[i][pCol] = null;
            } else {
                newT.A[i][pCol] = divVal(T.A[i][pCol], negP);
            }
        }
    }
    
    if (currentMode === 'bigm' && newT.nonBasicVars[pCol].startsWith('v')) {
        newT.c[pCol] = null;
    } else {
        newT.c[pCol] = divVal(T.c[pCol], negP);
    }

    for(let i=0; i<T.basicVars.length; i++) {
        if(i === pRow) continue;
        
        // Dual: Bỏ qua hoàn toàn việc tính toán các cột khác của hàng đã bị gạch bỏ
        if (currentMode === 'dual' && newT.droppedRows.includes(i)) {
            for(let j=0; j<T.nonBasicVars.length; j++) {
                newT.A[i][j] = null;
            }
            continue;
        }

        for(let j=0; j<T.nonBasicVars.length; j++) {
            if(j === pCol) continue;
            
            if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
                newT.A[i][j] = null;
                continue;
            }
            
            let cross = divVal(mulVal(T.A[pRow][j], T.A[i][pCol]), P);
            newT.A[i][j] = subVal(T.A[i][j], cross);
        }
        let bCross = divVal(mulVal(T.b[pRow], T.A[i][pCol]), P);
        newT.b[i] = subVal(T.b[i], bCross);
    }

    for(let j=0; j<T.nonBasicVars.length; j++) {
        if(j === pCol) continue;
        
        if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
            newT.c[j] = null;
            continue;
        }
        
        let cCross = divVal(mulVal(T.c[pCol], T.A[pRow][j]), P);
        newT.c[j] = subVal(T.c[j], cCross);
    }
    
    let fCross = divVal(mulVal(T.c[pCol], T.b[pRow]), P);
    newT.f = subVal(T.f, fCross);

    return newT;
}

function formatM(frac) {
    if (!frac || frac.isZero()) return "0";
    if (frac.n === 1 && frac.d === 1) return "M";
    if (frac.n === -1 && frac.d === 1) return "-M";
    return frac.toString() + "M";
}

function renderTableau(T, iter, pRow, pCol) {
    const output = document.getElementById('outputArea');
    let html = `<div class="step-container">`;
    html += `<div class="step-title">Bảng thứ ${iter+1}:</div>`;
    html += `<table class="simplex-table">`;
    
    if (currentMode === 'standard' || currentMode === 'dual') {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            // Không bao giờ gạch bỏ cột ở chế độ đối ngẫu
            html += `<th>${T.nonBasicVars[j]}</th>`;
        }
        html += `</tr><tr>`;
        
        let fStr = currentMode === 'dual' ? formatBigMFracSingleLine(T.f) : T.f.toString();
        html += `<th colspan="2">${fStr}</th>`;
        
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let cellVal = "";
            if (T.c[j] !== null) {
                cellVal = currentMode === 'dual' ? formatBigMFracSingleLine(T.c[j]) : T.c[j].toString();
            }
            html += `<td ${j === pCol ? 'class="pivot-element"' : ''}>${cellVal}</td>`;
        }
        html += `</tr>`;
    } else {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isDropped = T.nonBasicVars[j].startsWith('v');
            html += `<th ${isDropped ? 'class="dropped-cell"' : ''}>${T.nonBasicVars[j]}</th>`;
        }
        html += '</tr>';
        
        html += `<tr><th colspan="2" style="white-space:nowrap;">${formatM(T.f.m)}</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isDropped = T.nonBasicVars[j].startsWith('v');
            if (isDropped) {
                html += `<td class="dropped-cell"></td>`;
            } else {
                html += `<td ${j === pCol ? 'class="pivot-element"' : ''}>${formatM(T.c[j].m)}</td>`;
            }
        }
        html += `</tr>`;
        
        html += `<tr><th colspan="2">${T.f.r.toString()}</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isDropped = T.nonBasicVars[j].startsWith('v');
            if (isDropped) {
                html += `<td class="dropped-cell"></td>`;
            } else {
                html += `<td ${j === pCol ? 'class="pivot-element"' : ''}>${T.c[j].r.toString()}</td>`;
            }
        }
        html += `</tr>`;
    }

    for(let i=0; i<T.basicVars.length; i++) {
        let isRowDropped = (currentMode === 'dual' && T.droppedRows && T.droppedRows.includes(i));
        
        html += `<tr><th ${isRowDropped ? 'class="dropped-cell"' : ''}>${T.basicVars[i]}</th>`;
        // Highlight cột b_i (hàng xoay)
        let isPivotRow = (i === pRow) ? 'class="pivot-element"' : '';
        let bValStr = "";
        if (!isRowDropped && T.b[i] !== null) {
            bValStr = currentMode === 'dual' ? formatBigMFracSingleLine(T.b[i]) : T.b[i].toString();
        }
        html += `<td ${isPivotRow} ${isRowDropped ? 'class="dropped-cell"' : ''}>${bValStr}</td>`;
        
        // Vẽ các ô a_ij
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isColDropped = (currentMode === 'bigm' && T.nonBasicVars[j].startsWith('v'));
            
            if (isColDropped || isRowDropped) {
                html += `<td class="dropped-cell"></td>`;
            } else {
                let tdAttr = "";
                // Nếu là phần tử xoay trung tâm: Nền vàng, chữ đỏ, in đậm
                if (i === pRow && j === pCol) {
                    tdAttr = 'class="pivot-element" style="color:red; font-weight:bold;"';
                } 
                // Nếu nằm trong hàng xoay hoặc cột xoay (nhưng không phải phần tử xoay): Nền vàng, không in đậm
                else if (i === pRow || j === pCol) {
                    tdAttr = 'class="pivot-element" style="font-weight:normal;"';
                }
                
                html += `<td ${tdAttr}>${T.A[i][j] ? T.A[i][j].toString() : ''}</td>`;
            }
        }
        html += `</tr>`;
    }
    
    html += `</table></div>`;
    output.innerHTML += html;
}

// --- 4. LƯU TRỮ TRẠNG THÁI VÀ CHIA SẺ URL ---

// Gom toàn bộ dữ liệu trên lưới thành một Object
function getProblemState() {
    let state = {
        mode: currentMode,
        rows: document.getElementById('numRows').value,
        cols: document.getElementById('numCols').value,
        inputs: {}
    };
    let container = document.getElementById('inputGridContainer');
    let inputs = container.querySelectorAll('input[type="text"], input[type="checkbox"]');
    inputs.forEach(inp => {
        if (inp.type === 'checkbox') {
            state.inputs[inp.id] = inp.checked;
        } else {
            state.inputs[inp.id] = inp.value;
        }
    });
    return state;
}

// Khôi phục dữ liệu từ Object và tự động giải
function loadProblemState(state) {
    // 1. Cập nhật số hàng, cột và chế độ
    document.getElementById('numRows').value = state.rows;
    document.getElementById('numCols').value = state.cols;
    setMode(state.mode); // Hàm này tự động gọi generateInputGrid() tạo lại bảng trắng

    // 2. Bơm dữ liệu vào bảng
    for (let id in state.inputs) {
        let el = document.getElementById(id);
        if (el) {
            if (el.type === 'checkbox') {
                el.checked = state.inputs[id];
                // Kích hoạt lại giao diện ẩn giả
                if (id.startsWith('chk_art_')) {
                    let rowIdx = parseInt(id.split('_')[2]);
                    toggleArtificial(rowIdx); 
                }
            } else {
                el.value = state.inputs[id];
            }
        }
    }
    
    // 3. Tự động giải luôn mà không lưu đè lịch sử URL
    startSolving(false); 
}

// --- THÔNG BÁO TOAST MƯỢT MÀ ---
function showToast(message) {
    let toast = document.getElementById("toastNotification");
    // Tự động tạo thẻ div chứa thông báo nếu chưa có
    if (!toast) {
        toast = document.createElement("div");
        toast.id = "toastNotification";
        toast.className = "toast-message";
        document.body.appendChild(toast);
    }
    toast.textContent = message;
    toast.classList.add("show");
    
    // Xóa bộ đếm cũ nếu người dùng bấm liên tục
    if(toast.timeoutId) clearTimeout(toast.timeoutId);
    
    // Tự động ẩn sau 2.5 giây
    toast.timeoutId = setTimeout(function() { 
        toast.classList.remove("show"); 
    }, 2000);
}

// --- LÀM MỚI BÀI TOÁN ---
function resetProblem() {
    // 1. Dùng lại hàm setMode để tạo lưới trắng tinh tươm
    setMode(currentMode); 
    
    // 2. Xóa vùng kết quả đang hiển thị
    document.getElementById('outputArea').innerHTML = ''; 
    
    // 3. Xóa dữ liệu cũ trên thanh địa chỉ URL
    let cleanUrl = window.location.origin + window.location.pathname;
    window.history.pushState({}, '', cleanUrl);
    
    // showToast("Đã làm mới dữ liệu và URL!");
}

// Chức năng sao chép URL
function isMobileDevice() {
    return /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) 
        || (window.innerWidth <= 540);
}

function copyShareLink() {
    let state = getProblemState();
    let encoded = btoa(encodeURIComponent(JSON.stringify(state))); 
    let shareUrl = window.location.origin + window.location.pathname + "?data=" + encoded;
    
    navigator.clipboard.writeText(shareUrl).then(() => {
        // Chỉ hiện toast riêng nếu KHÔNG PHẢI điện thoại (để tránh trùng với thông báo của hệ điều hành)
        if (!isMobileDevice()) {
            showToast("🔗 Đã sao chép link bài toán!");
        }
    }).catch(err => {
        showToast("Lỗi sao chép: " + err);
    });
}
// --- 5. XỬ LÝ LỊCH SỬ TRÌNH DUYỆT VÀ URL ---

// Kiểm tra xem URL hiện tại có chứa chuỗi bài toán hay không
function checkUrlForData() {
    let params = new URLSearchParams(window.location.search);
    let data = params.get('data');
    if (data) {
        try {
            let state = JSON.parse(decodeURIComponent(atob(data)));
            loadProblemState(state);
            return true; // Báo hiệu là đã có data trong link
        } catch (e) {
            console.error("Dữ liệu URL không hợp lệ hoặc bị hỏng", e);
        }
    }
    return false;
}

// Bắt sự kiện khi người dùng bấm nút Back / Forward trên trình duyệt
window.addEventListener('popstate', function(event) {
    if (event.state && event.state.stateData) {
        // Nếu trình duyệt có lưu trạng thái, khôi phục lại
        loadProblemState(event.state.stateData);
    } else {
        // Kiểm tra lại trên URL
        checkUrlForData();
    }
});

// Chạy khi tải trang lần đầu
window.onload = function() {
    if (!checkUrlForData()) {
        let savedRows = localStorage.getItem('simplex_rows');
        let savedCols = localStorage.getItem('simplex_cols');
        if (savedRows) document.getElementById('numRows').value = savedRows;
        if (savedCols) document.getElementById('numCols').value = savedCols;

        let savedMode = localStorage.getItem('simplex_mode') || 'standard';
        setMode(savedMode); 
    }
};

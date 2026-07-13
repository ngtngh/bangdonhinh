let currentMode = 'bigm'; // Mặc định chuyển sang Big-M để test

function setMode(mode) {
    localStorage.setItem('simplex_mode', mode);
    currentMode = mode;
    document.getElementById('tab-standard').classList.remove('active');
    document.getElementById('tab-bigm').classList.remove('active');
    document.getElementById(`tab-${mode}`).classList.add('active');
    document.getElementById('outputArea').innerHTML = '';
    // Tự động tạo lại bảng khi chuyển đổi tab để trải nghiệm mượt mà hơn
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

function subScalar(a, b) { return currentMode === 'bigm' ? a.sub(b) : a.sub(b); }
function mulByFrac(a, frac) { return currentMode === 'bigm' ? a.mulFrac(frac) : a.mul(frac); }
function divByFrac(a, frac) { return currentMode === 'bigm' ? a.divFrac(frac) : a.div(frac); }

// --- 2. GIAO DIỆN NHẬP LIỆU ---
function toggleArtificial(i) {
    let cb = document.getElementById(`chk_art_${i}`);
    let input = document.getElementById(`bVar_${i}`);
    input.value = cb.checked ? `v${i+1}` : `w${i+1}`;
}

// Lọc ký tự: Chỉ cho phép số, dấu chấm (thập phân), dấu gạch chéo (phân số), dấu trừ (số âm)
function sanitizeInput(el) {
    el.value = el.value.replace(/[^0-9\.\-\/]/g, '');
}

// Mặc định về 0 nếu người dùng xóa sạch giá trị
function setDefaultZero(el) {
    if (el.value.trim() === '') el.value = '0';
}

function generateInputGrid() {
    let rInput = document.getElementById('numRows');
    let cInput = document.getElementById('numCols');
    
    // Đảm bảo số dòng/cột là số nguyên dương, mặc định là 1
    let rows = parseInt(rInput.value);
    let cols = parseInt(cInput.value);
    if (isNaN(rows) || rows < 1) rows = 1;
    if (isNaN(cols) || cols < 1) cols = 1;
    
    rInput.value = rows;
    cInput.value = cols;
    
    // Lưu cấu hình vào localStorage
    localStorage.setItem('simplex_rows', rows);
    localStorage.setItem('simplex_cols', cols);

    const inputValidation = `oninput="sanitizeInput(this)" onblur="setDefaultZero(this)"`;
    let html = '<table class="simplex-table">';
    
    if (currentMode === 'standard') {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=1; j<=cols; j++) html += `<th><input type="text" id="nbVar_${j-1}" value="x${j}" class="input-cell" style="font-style:italic; font-weight:bold;"></th>`;
        html += `</tr><tr>`;
        html += `<th colspan="2"><input type="text" id="val_f" placeholder="0" value="" class="input-cell" ${inputValidation}></th>`;
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        html += `</tr>`;
    } else {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=1; j<=cols; j++) html += `<th><input type="text" id="nbVar_${j-1}" value="x${j}" class="input-cell" style="font-style:italic; font-weight:bold;"></th>`;
        html += '</tr>';
        html += `<tr><th colspan="2" style="white-space:nowrap;"><input type="text" id="val_f_m" placeholder="0" value="" class="input-cell" ${inputValidation}> <strong>M</strong></th>`;
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_m_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}> <strong>M</strong></td>`;
        html += '</tr><tr><th colspan="2"><input type="text" id="val_f_r" placeholder="0" value="" class="input-cell" ${inputValidation}></th>';
        for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_r_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        html += '</tr>';
    }

    for(let i=1; i<=rows; i++) {
        let bVarTpl = currentMode === 'bigm' ? 
            `<input type="text" id="bVar_${i-1}" value="w${i}" class="input-cell" style="font-style:italic; font-weight:bold;"><br><label style="font-size: 0.8em;"><input type="checkbox" id="chk_art_${i-1}" class="artificial-cb" onchange="toggleArtificial(${i-1})"> Ẩn giả</label>` :
            `<input type="text" id="bVar_${i-1}" value="w${i}" class="input-cell" style="font-style:italic; font-weight:bold;">`;

        html += `<tr><th>${bVarTpl}</th>`;
        html += `<td><input type="text" id="val_b_${i-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        for(let j=1; j<=cols; j++) {
            html += `<td><input type="text" id="val_A_${i-1}_${j-1}" placeholder="0" value="" class="input-cell" ${inputValidation}></td>`;
        }
        html += '</tr>';
    }
    html += '</table>';
    
    document.getElementById('inputGridContainer').innerHTML = html;
    document.getElementById('controls').style.display = 'block';
    document.getElementById('outputArea').innerHTML = '';
}

// --- 3. THUẬT TOÁN CỐT LÕI VÀ HIỂN THỊ ---
function startSolving() {
    const output = document.getElementById('outputArea');
    output.innerHTML = '<h2>Quá trình giải:</h2>';
    const numRows = parseInt(document.getElementById('numRows').value);
    const numCols = parseInt(document.getElementById('numCols').value);
    
    let T = { basicVars: [], nonBasicVars: [], c: [], b: [], A: [], f: null };

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

    let iteration = 0;
    const maxIter = 20;

    while(iteration < maxIter) {
        let pCol = -1;
        let minC = currentMode === 'standard' ? new Frac(0) : new BigMFrac(new Frac(0), new Frac(0));

        // 1. Tìm cột xoay
        for(let j=0; j<T.c.length; j++) {
            if (currentMode === 'bigm' && T.nonBasicVars[j].startsWith('v')) continue; 
            
            if (T.c[j] !== null && T.c[j].isNegative() && T.c[j].cmp(minC) < 0) {
                minC = T.c[j];
                pCol = j;
            }
        }

        if (pCol === -1) {
            renderTableau(T, iteration, -1, -1);
            if (currentMode === 'standard') {
                let hasZeroDelta = false;
                for(let j=0; j<T.c.length; j++) {
                    if (T.c[j] !== null && T.c[j].isZero()) {
                        hasZeroDelta = true;
                        break;
                    }
                }
                if (hasZeroDelta) {
                    output.innerHTML += '<div class="status-optimal">Tồn tại biến ngoài cơ sở có hệ số bằng 0. Bài toán có VÔ SỐ nghiệm tối ưu.</div>';
                } else {
                    output.innerHTML += '<div class="status-optimal">Hệ số các biến ngoài cơ sở đều dương. Kết luận nghiệm tối ưu của bài toán.</div>';
                }
            } else {
                let hasPositiveArtificial = false;
                for(let i=0; i<T.basicVars.length; i++) {
                    if (T.basicVars[i].startsWith('v') && T.b[i].isPositive()) {
                        hasPositiveArtificial = true;
                        break;
                    }
                }
                if (hasPositiveArtificial) {
                    output.innerHTML += '<div class="status-infeasible">Tồn tại ẩn giả dương trong cơ sở. Bài toán gốc VÔ NGHIỆM.</div>';
                } else {
                    output.innerHTML += '<div class="status-optimal">Mọi ẩn giả bằng 0. Kết luận nghiệm tối ưu của bài toán.</div>';
                }
            }
            break;
        }

        let pRow = -1;
        let minRatio = null;
        for(let i=0; i<T.A.length; i++) {
            if (T.A[i][pCol] !== null && T.A[i][pCol].isPositive()) {
                let ratio = T.b[i].div(T.A[i][pCol]);
                if (minRatio === null || ratio.cmp(minRatio) < 0) {
                    minRatio = ratio;
                    pRow = i;
                }
            }
        }

        if (pRow === -1) {
            renderTableau(T, iteration, -1, pCol);
            if (currentMode === 'standard') {
                output.innerHTML += '<div class="status-unbounded">Tồn tại cột xoay chứa các hệ số không dương. Hàm mục tiêu KHÔNG BỊ CHẶN.</div>';
            } else {
                let hasPositiveArtificial = false;
                for(let i=0; i<T.basicVars.length; i++) {
                    if (T.basicVars[i].startsWith('v') && T.b[i].isPositive()) {
                        hasPositiveArtificial = true;
                        break;
                    }
                }
                if (hasPositiveArtificial) {
                    output.innerHTML += '<div class="status-infeasible">Hàm mục tiêu KHÔNG BỊ CHẶN. Tồn tại ẩn giả dương trong cơ sở. Bài toán gốc VÔ NGHIỆM</div>';
                } else {
                    output.innerHTML += '<div class="status-unbounded">Hàm mục tiêu KHÔNG BỊ CHẶN. Mọi ẩn giả bằng 0. Bài toán gốc có hàm mục tiêu cũng KHÔNG BỊ CHẶN.</div>';
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
    let newT = { basicVars: [...T.basicVars], nonBasicVars: [...T.nonBasicVars], A: [], b: [], c: [], f: null };
    
    newT.basicVars[pRow] = T.nonBasicVars[pCol];
    newT.nonBasicVars[pCol] = T.basicVars[pRow];

    let invP = new Frac(1).div(P);
    let negP = P.neg();

    for(let i=0; i<T.basicVars.length; i++) newT.A.push([]);

    for(let j=0; j<T.nonBasicVars.length; j++) {
        if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
            newT.A[pRow][j] = null;
        } else if(j === pCol) {
            newT.A[pRow][j] = invP;
        } else {
            newT.A[pRow][j] = T.A[pRow][j].mul(invP);
        }
    }
    
    newT.b[pRow] = T.b[pRow].mul(invP);

    for(let i=0; i<T.basicVars.length; i++) {
        if(i !== pRow) {
            if (currentMode === 'bigm' && newT.nonBasicVars[pCol].startsWith('v')) {
                newT.A[i][pCol] = null;
            } else {
                newT.A[i][pCol] = T.A[i][pCol].div(negP);
            }
        }
    }
    
    if (currentMode === 'bigm' && newT.nonBasicVars[pCol].startsWith('v')) {
        newT.c[pCol] = null;
    } else {
        newT.c[pCol] = divByFrac(T.c[pCol], negP);
    }

    for(let i=0; i<T.basicVars.length; i++) {
        if(i === pRow) continue;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            if(j === pCol) continue;
            
            if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
                newT.A[i][j] = null;
                continue;
            }
            
            let cross = T.A[pRow][j].mul(T.A[i][pCol]).div(P);
            newT.A[i][j] = T.A[i][j].sub(cross);
        }
        let bCross = T.b[pRow].mul(T.A[i][pCol]).div(P);
        newT.b[i] = T.b[i].sub(bCross);
    }

    for(let j=0; j<T.nonBasicVars.length; j++) {
        if(j === pCol) continue;
        
        if (currentMode === 'bigm' && newT.nonBasicVars[j].startsWith('v')) {
            newT.c[j] = null;
            continue;
        }
        
        let cCross = divByFrac(mulByFrac(T.c[pCol], T.A[pRow][j]), P);
        newT.c[j] = subScalar(T.c[j], cCross);
    }
    
    let fCross = divByFrac(mulByFrac(T.c[pCol], T.b[pRow]), P);
    newT.f = subScalar(T.f, fCross);

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
    html += `<div class="step-title">Bảng lặp thứ ${iter}:</div>`;
    html += `<table class="simplex-table">`;
    
    if (currentMode === 'standard') {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) html += `<th>${T.nonBasicVars[j]}</th>`;
        html += `</tr><tr>`;
        html += `<th colspan="2">${T.f.toString()}</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            html += `<td ${j === pCol ? 'class="pivot-element"' : ''}>${T.c[j] ? T.c[j].toString() : ''}</td>`;
        }
        html += `</tr>`;
    } else {
        html += `<tr><th colspan="2">f</th>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isDropped = T.nonBasicVars[j].startsWith('v');
            html += `<th ${isDropped ? 'class="dropped-cell"' : ''}>${T.nonBasicVars[j]}</th>`;
        }
        html += `</tr>`;
        
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
        html += `<tr><th>${T.basicVars[i]}</th>`;
        let isPivotRow = (i === pRow) ? 'class="pivot-element"' : '';
        html += `<td ${isPivotRow}>${T.b[i].toString()}</td>`;
        
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isDropped = (currentMode === 'bigm' && T.nonBasicVars[j].startsWith('v'));
            if (isDropped) {
                html += `<td class="dropped-cell"></td>`;
            } else {
                let isPivotCell = (i === pRow && j === pCol) ? 'class="pivot-element" style="color:red;"' : '';
                html += `<td ${isPivotCell}>${T.A[i][j] ? T.A[i][j].toString() : ''}</td>`;
            }
        }
        html += `</tr>`;
    }
    
    html += `</table></div>`;
    output.innerHTML += html;
}

window.onload = function() { 
    // Khôi phục kích thước bảng từ localStorage nếu có
    let savedRows = localStorage.getItem('simplex_rows');
    let savedCols = localStorage.getItem('simplex_cols');
    if (savedRows) document.getElementById('numRows').value = savedRows;
    if (savedCols) document.getElementById('numCols').value = savedCols;

    let savedMode = localStorage.getItem('simplex_mode') || 'standard';
    setMode(savedMode); 
};
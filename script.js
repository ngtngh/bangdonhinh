// --- 1. LỚP PHÂN SỐ (Xử lý số liệu chuẩn xác) ---
class Frac {
    constructor(n, d = 1) {
        if (d === 0) throw "Lỗi chia cho 0";
        let sign = (n * d < 0) ? -1 : 1;
        n = Math.abs(n); d = Math.abs(d);
        let g = this.gcd(n, d);
        this.n = sign * (n / g);
        this.d = d / g;
    }
    gcd(a, b) {
        a = Math.abs(a); b = Math.abs(b);
        while (b) { let t = b; b = a % b; a = t; }
        return a;
    }
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

// --- 2. GIAO DIỆN NHẬP LIỆU ---
function generateInputGrid() {
    const rows = parseInt(document.getElementById('numRows').value);
    const cols = parseInt(document.getElementById('numCols').value);
    let html = '<table class="simplex-table">';
    
    // Dòng tiêu đề
    html += `<tr><th rowspan="2" colspan="2">f = <input type="text" id="val_f" value="0" class="input-cell"></th>`;
    for(let j=1; j<=cols; j++) html += `<th><input type="text" id="nbVar_${j-1}" value="x${j}" class="input-cell" style="font-style:italic; font-weight:bold;"></th>`;
    html += '</tr><tr>';
    for(let j=1; j<=cols; j++) html += `<td><input type="text" id="val_c_${j-1}" placeholder="-c${j}" value="0" class="input-cell"></td>`;
    html += '</tr>';

    // Các dòng ràng buộc
    for(let i=1; i<=rows; i++) {
        html += `<tr><th><input type="text" id="bVar_${i-1}" value="w${i}" class="input-cell" style="font-style:italic; font-weight:bold;"></th>`;
        html += `<td><input type="text" id="val_b_${i-1}" placeholder="b${i}" value="0" class="input-cell"></td>`;
        for(let j=1; j<=cols; j++) {
            html += `<td><input type="text" id="val_A_${i-1}_${j-1}" value="0" class="input-cell"></td>`;
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
    
    // Khởi tạo trạng thái bảng
    let T = {
        basicVars: [], nonBasicVars: [],
        f: parseFrac(document.getElementById('val_f').value),
        c: [], b: [], A: []
    };

    for(let j=0; j<numCols; j++) {
        T.nonBasicVars.push(document.getElementById(`nbVar_${j}`).value);
        T.c.push(parseFrac(document.getElementById(`val_c_${j}`).value));
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
        // 1. Tìm cột xoay (pivot column) có -cj âm nhất
        let pCol = -1;
        let minC = new Frac(0);
        for(let j=0; j<T.c.length; j++) {
            if (T.c[j].isNegative() && T.c[j].cmp(minC) < 0) {
                minC = T.c[j];
                pCol = j;
            }
        }

        // Kiểm tra tối ưu
        if (pCol === -1) {
            renderTableau(T, iteration, -1, -1);
            
            // Kiểm tra vô số nghiệm (nếu có -cj = 0 cho biến ngoài cơ sở)
            let hasZeroC = T.c.some(cj => cj.isZero());
            if (hasZeroC) {
                output.innerHTML += '<p class="status-optimal">Tồn tại biến ngoài cơ sở có hệ số bằng 0. Bài toán có VÔ SỐ nghiệm tối ưu.</p>';
            } else {
                output.innerHTML += '<p class="status-optimal">Hệ số các biến ngoài cơ sở đều dương. Bài toán có nghiệm tối ưu DUY NHẤT.</p>';
            }
            break;
        }

        // 2. Tìm hàng xoay (pivot row) bằng tỷ số min b_i / a_ij (với a_ij > 0)
        let pRow = -1;
        let minRatio = null;
        for(let i=0; i<T.A.length; i++) {
            if (T.A[i][pCol].isPositive()) {
                let ratio = T.b[i].div(T.A[i][pCol]);
                if (minRatio === null || ratio.cmp(minRatio) < 0) {
                    minRatio = ratio;
                    pRow = i;
                }
            }
        }

        // Kiểm tra không bị chặn
        if (pRow === -1) {
            renderTableau(T, iteration, -1, pCol);
            output.innerHTML += '<p class="status-unbounded">Tồn tại cột xoay chứa các hệ số không dương. Hàm mục tiêu KHÔNG BỊ CHẶN.</p>';
            break;
        }

        // Hiển thị bảng hiện tại trước khi biến đổi
        renderTableau(T, iteration, pRow, pCol);

        // 3. Thực hiện biến đổi xoay (Pivoting) - Quy tắc hình chữ nhật
        T = pivot(T, pRow, pCol);
        iteration++;
    }
}

function pivot(T, pRow, pCol) {
    let P = T.A[pRow][pCol];
    let newT = {
        basicVars: [...T.basicVars],
        nonBasicVars: [...T.nonBasicVars],
        A: [], b: [], c: [], f: null
    };
    
    // Đổi vị trí biến
    newT.basicVars[pRow] = T.nonBasicVars[pCol];
    newT.nonBasicVars[pCol] = T.basicVars[pRow];

    let invP = new Frac(1).div(P);
    let negP = P.neg();

    for(let i=0; i<T.basicVars.length; i++) newT.A.push([]);

    // Hàng xoay mới
    for(let j=0; j<T.nonBasicVars.length; j++) {
        if(j === pCol) newT.A[pRow][j] = invP;
        else newT.A[pRow][j] = T.A[pRow][j].mul(invP);
    }
    newT.b[pRow] = T.b[pRow].mul(invP);

    // Cột xoay mới
    for(let i=0; i<T.basicVars.length; i++) {
        if(i !== pRow) newT.A[i][pCol] = T.A[i][pCol].div(negP);
    }
    newT.c[pCol] = T.c[pCol].div(negP);

    // Quy tắc hình chữ nhật cho các phần tử còn lại
    for(let i=0; i<T.basicVars.length; i++) {
        if(i === pRow) continue;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            if(j === pCol) continue;
            let cross = T.A[pRow][j].mul(T.A[i][pCol]).div(P);
            newT.A[i][j] = T.A[i][j].sub(cross);
        }
        let bCross = T.b[pRow].mul(T.A[i][pCol]).div(P);
        newT.b[i] = T.b[i].sub(bCross);
    }

    // Hàng c và f mới
    for(let j=0; j<T.nonBasicVars.length; j++) {
        if(j === pCol) continue;
        let cCross = T.A[pRow][j].mul(T.c[pCol]).div(P);
        newT.c[j] = T.c[j].sub(cCross);
    }
    let fCross = T.b[pRow].mul(T.c[pCol]).div(P);
    newT.f = T.f.sub(fCross);

    return newT;
}

function renderTableau(T, iter, pRow, pCol) {
    const output = document.getElementById('outputArea');
    let html = `<div class="step-container">`; // Mở container bọc ngoài
    html += `<div class="step-title">Bảng lặp thứ ${iter}:</div>`;
    html += `<table class="simplex-table">`;
    
    html += `<tr><th rowspan="2" colspan="2">f = ${T.f.toString()}</th>`;
    for(let j=0; j<T.nonBasicVars.length; j++) {
        html += `<th>${T.nonBasicVars[j]}</th>`;
    }
    html += `</tr><tr>`;
    
    for(let j=0; j<T.nonBasicVars.length; j++) {
        let isPivotCol = (j === pCol) ? 'class="pivot-element"' : '';
        html += `<td ${isPivotCol}>${T.c[j].toString()}</td>`;
    }
    html += `</tr>`;

    for(let i=0; i<T.basicVars.length; i++) {
        html += `<tr><th>${T.basicVars[i]}</th>`;
        let isPivotRow = (i === pRow) ? 'class="pivot-element"' : '';
        html += `<td ${isPivotRow}>${T.b[i].toString()}</td>`;
        for(let j=0; j<T.nonBasicVars.length; j++) {
            let isPivotCell = (i === pRow && j === pCol) ? 'class="pivot-element" style="color:red;"' : '';
            html += `<td ${isPivotCell}>${T.A[i][j].toString()}</td>`;
        }
        html += `</tr>`;
    }
    
    html += `</table>`;
    html += `</div>`; // Đóng container bọc ngoài
    
    output.innerHTML += html;
}

window.onload = function() { 
    generateInputGrid(); 
    // document.getElementById('val_c_0').value = "1";
    // document.getElementById('val_c_1').value = "-3";
    // document.getElementById('val_b_0').value = "25";
    // document.getElementById('val_A_0_0').value = "2";
    // document.getElementById('val_A_0_1').value = "3";
    // document.getElementById('val_b_1').value = "15";
    // document.getElementById('val_A_1_0').value = "1";
    // document.getElementById('val_A_1_1').value = "1";
};

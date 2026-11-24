// Install as an app (PWA): when the page is served over http(s), register the service worker that
// caches EvenUCan for offline use. Skipped for file:// (browsers forbid it there).
if(/^https?:$/.test(location.protocol)&&'serviceWorker' in navigator){
  window.addEventListener('load',()=>{navigator.serviceWorker.register('sw.js').catch(e=>console.warn('EvenUCan: could not set up offline use',e));});
}


// The shared bridge to the editor (this file is a plain script, so it asks for it by name)
const _snapInt = (window.WFEnclosure && window.WFEnclosure._internal) || {};

// ==================== Standalone QR Code Generator ====================

/**
 * Tiny self-contained QR Code Generator (Arase QRCode minified clean)
 * Supports Byte mode (UTF-8/ASCII), ECC L/M, Versions 1-10.
 */
var QRCode = (function() {
  function QR8bitByte(data) {
    this.mode = 4;
    this.data = data;
  }
  QR8bitByte.prototype = {
    getLength: function() { return this.data.length; },
    write: function(buffer) {
      for (var i = 0; i < this.data.length; i++) {
        buffer.put(this.data.charCodeAt(i), 8);
      }
    }
  };

  var QRMath = {
    glog: function(n) {
      if (n < 1) throw new Error("glog(" + n + ")");
      return QRMath.LOG_TABLE[n];
    },
    gexp: function(n) {
      while (n < 0) n += 255;
      while (n >= 255) n -= 255;
      return QRMath.EXP_TABLE[n];
    },
    EXP_TABLE: new Array(256),
    LOG_TABLE: new Array(256)
  };
  for (var i = 0; i < 8; i++) QRMath.EXP_TABLE[i] = 1 << i;
  for (var i = 8; i < 256; i++) QRMath.EXP_TABLE[i] = QRMath.EXP_TABLE[i - 4] ^ QRMath.EXP_TABLE[i - 5] ^ QRMath.EXP_TABLE[i - 6] ^ QRMath.EXP_TABLE[i - 8];
  for (var i = 0; i < 255; i++) QRMath.LOG_TABLE[QRMath.EXP_TABLE[i]] = i;

  function QRPolynomial(num, shift) {
    if (num.length == undefined) throw new Error(num.length + "/" + shift);
    var offset = 0;
    while (offset < num.length && num[offset] == 0) offset++;
    this.num = new Array(num.length - offset + shift);
    for (var i = 0; i < num.length - offset; i++) this.num[i] = num[i + offset];
    for (var i = num.length - offset; i < this.num.length; i++) this.num[i] = 0;
  }
  QRPolynomial.prototype = {
    get: function(index) { return this.num[index]; },
    getLength: function() { return this.num.length; },
    multiply: function(e) {
      var num = new Array(this.getLength() + e.getLength() - 1);
      for (var i = 0; i < num.length; i++) num[i] = 0;
      for (var i = 0; i < this.getLength(); i++) {
        for (var j = 0; j < e.getLength(); j++) {
          num[i + j] ^= QRMath.gexp(QRMath.glog(this.get(i)) + QRMath.glog(e.get(j)));
        }
      }
      return new QRPolynomial(num, 0);
    },
    mod: function(e) {
      if (this.getLength() - e.getLength() < 0) return this;
      var ratio = QRMath.glog(this.get(0)) - QRMath.glog(e.get(0));
      var num = new Array(this.getLength());
      for (var i = 0; i < this.getLength(); i++) num[i] = this.get(i);
      for (var i = 0; i < e.getLength(); i++) {
        num[i] ^= QRMath.gexp(QRMath.glog(e.get(i)) + ratio);
      }
      return new QRPolynomial(num, 0).mod(e);
    }
  };

  function QRRSBlock(totalCount, dataCount) {
    this.totalCount = totalCount;
    this.dataCount = dataCount;
  }
  QRRSBlock.RS_BLOCK_TABLE = [
    [1, 26, 19], [1, 26, 16], [1, 26, 13], [1, 26, 9],
    [1, 44, 34], [1, 44, 28], [1, 44, 22], [1, 44, 16],
    [1, 70, 55], [1, 70, 44], [2, 35, 17], [2, 35, 13],
    [1, 100, 80], [2, 50, 32], [2, 50, 24], [4, 25, 9],
    [1, 134, 108], [2, 67, 43], [2, 33, 15, 2, 34, 16], [2, 33, 11, 2, 34, 12],
    [2, 86, 68], [4, 43, 27], [4, 43, 19], [4, 43, 15],
    [2, 98, 78], [4, 49, 31], [2, 32, 14, 4, 33, 15], [4, 39, 13, 1, 40, 14],
    [2, 121, 97], [2, 60, 38, 2, 61, 39], [4, 40, 18, 2, 41, 19], [4, 40, 14, 2, 41, 15],
    [2, 146, 116], [3, 58, 36, 2, 59, 37], [4, 36, 16, 4, 37, 17], [4, 36, 12, 4, 37, 13],
    [2, 86, 68, 2, 87, 69], [4, 69, 43, 1, 70, 44], [6, 43, 19, 2, 44, 20], [6, 43, 15, 2, 44, 16]
  ];
  QRRSBlock.getRSBlocks = function(typeNumber, errorCorrectLevel) {
    var rsBlock = QRRSBlock.getRsBlockTable(typeNumber, errorCorrectLevel);
    if (rsBlock == undefined) throw new Error("bad rs block: " + typeNumber + "/" + errorCorrectLevel);
    var length = rsBlock.length / 3;
    var list = [];
    for (var i = 0; i < length; i++) {
      var count = rsBlock[i * 3 + 0];
      var totalCount = rsBlock[i * 3 + 1];
      var dataCount = rsBlock[i * 3 + 2];
      for (var j = 0; j < count; j++) list.push(new QRRSBlock(totalCount, dataCount));
    }
    return list;
  };
  QRRSBlock.getRsBlockTable = function(typeNumber, errorCorrectLevel) {
    switch (errorCorrectLevel) {
      case 1: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 0];
      case 0: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 1];
      case 3: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 2];
      case 2: return QRRSBlock.RS_BLOCK_TABLE[(typeNumber - 1) * 4 + 3];
      default: return undefined;
    }
  };

  function QRBitBuffer() {
    this.buffer = [];
    this.length = 0;
  }
  QRBitBuffer.prototype = {
    get: function(index) {
      var bufIndex = Math.floor(index / 8);
      return ((this.buffer[bufIndex] >>> (7 - index % 8)) & 1) == 1;
    },
    put: function(num, length) {
      for (var i = 0; i < length; i++) {
        this.putBit(((num >>> (length - i - 1)) & 1) == 1);
      }
    },
    putBit: function(bit) {
      var bufIndex = Math.floor(this.length / 8);
      if (this.buffer.length <= bufIndex) this.buffer.push(0);
      if (bit) this.buffer[bufIndex] |= (0x80 >>> (this.length % 8));
      this.length++;
    }
  };

  function QRCodeModel(typeNumber, errorCorrectLevel) {
    this.typeNumber = typeNumber;
    this.errorCorrectLevel = errorCorrectLevel;
    this.modules = null;
    this.moduleCount = 0;
    this.dataCache = null;
    this.dataList = [];
  }
  QRCodeModel.prototype = {
    addData: function(data) {
      this.dataList.push(new QR8bitByte(data));
      this.dataCache = null;
    },
    isDark: function(row, col) {
      if (row < 0 || this.moduleCount <= row || col < 0 || this.moduleCount <= col) {
        throw new Error(row + "," + col);
      }
      return this.modules[row][col];
    },
    getModuleCount: function() { return this.moduleCount; },
    make: function() {
      if (this.typeNumber < 1) {
        for (var type = 1; type < 10; type++) {
          var rsBlocks = QRRSBlock.getRSBlocks(type, this.errorCorrectLevel);
          var totalDataCount = 0;
          for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
          var buffer = new QRBitBuffer();
          for (var i = 0; i < this.dataList.length; i++) {
            var data = this.dataList[i];
            buffer.put(data.mode, 4);
            buffer.put(data.getLength(), 8);
            data.write(buffer);
          }
          if (buffer.length + 4 <= totalDataCount * 8) {
            this.typeNumber = type;
            break;
          }
        }
      }
      this.makeImpl(false, this.getBestMaskPattern());
    },
    makeImpl: function(test, maskPattern) {
      this.moduleCount = this.typeNumber * 4 + 17;
      this.modules = new Array(this.moduleCount);
      for (var row = 0; row < this.moduleCount; row++) {
        this.modules[row] = new Array(this.moduleCount);
        for (var col = 0; col < this.moduleCount; col++) this.modules[row][col] = null;
      }
      this.setupPositionProbePattern(0, 0);
      this.setupPositionProbePattern(this.moduleCount - 7, 0);
      this.setupPositionProbePattern(0, this.moduleCount - 7);
      this.setupPositionAdjustPattern();
      this.setupTimingPattern();
      this.setupTypeInfo(test, maskPattern);
      if (this.typeNumber >= 7) this.setupTypeNumber(test);
      if (this.dataCache == null) {
        this.dataCache = QRCodeModel.createData(this.typeNumber, this.errorCorrectLevel, this.dataList);
      }
      this.mapData(this.dataCache, maskPattern);
    },
    setupPositionProbePattern: function(row, col) {
      for (var r = -1; r <= 7; r++) {
        if (row + r <= -1 || this.moduleCount <= row + r) continue;
        for (var c = -1; c <= 7; c++) {
          if (col + c <= -1 || this.moduleCount <= col + c) continue;
          if ((0 <= r && r <= 6 && (c == 0 || c == 6)) || (0 <= c && c <= 6 && (r == 0 || r == 6)) || (2 <= r && r <= 4 && 2 <= c && c <= 4)) {
            this.modules[row + r][col + c] = true;
          } else {
            this.modules[row + r][col + c] = false;
          }
        }
      }
    },
    getBestMaskPattern: function() {
      var minLostPoint = 0, pattern = 0;
      for (var i = 0; i < 8; i++) {
        this.makeImpl(true, i);
        var lostPoint = QRUtil.getLostPoint(this);
        if (i == 0 || minLostPoint > lostPoint) {
          minLostPoint = lostPoint;
          pattern = i;
        }
      }
      return pattern;
    },
    setupTimingPattern: function() {
      for (var r = 8; r < this.moduleCount - 8; r++) {
        if (this.modules[r][6] != null) continue;
        this.modules[r][6] = (r % 2 == 0);
      }
      for (var c = 8; c < this.moduleCount - 8; c++) {
        if (this.modules[6][c] != null) continue;
        this.modules[6][c] = (c % 2 == 0);
      }
    },
    setupPositionAdjustPattern: function() {
      var pos = QRUtil.getPatternPosition(this.typeNumber);
      for (var i = 0; i < pos.length; i++) {
        for (var j = 0; j < pos.length; j++) {
          var row = pos[i], col = pos[j];
          if (this.modules[row][col] != null) continue;
          for (var r = -2; r <= 2; r++) {
            for (var c = -2; c <= 2; c++) {
              if (r == -2 || r == 2 || c == -2 || c == 2 || (r == 0 && c == 0)) {
                this.modules[row + r][col + c] = true;
              } else {
                this.modules[row + r][col + c] = false;
              }
            }
          }
        }
      }
    },
    setupTypeInfo: function(test, maskPattern) {
      var data = (this.errorCorrectLevel << 3) | maskPattern;
      var bits = QRUtil.getBCHTypeInfo(data);
      for (var i = 0; i < 15; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        if (i < 6) this.modules[i][8] = mod;
        else if (i < 8) this.modules[i + 1][8] = mod;
        else this.modules[this.moduleCount - 15 + i][8] = mod;
        if (i < 8) this.modules[8][this.moduleCount - i - 1] = mod;
        else if (i < 9) this.modules[8][15 - i - 1 + 1] = mod;
        else this.modules[8][15 - i - 1] = mod;
      }
      this.modules[this.moduleCount - 8][8] = (!test);
    },
    setupTypeNumber: function(test) {
      var bits = QRUtil.getBCHTypeNumber(this.typeNumber);
      for (var i = 0; i < 18; i++) {
        var mod = (!test && ((bits >> i) & 1) == 1);
        this.modules[Math.floor(i / 3)][i % 3 + this.moduleCount - 8 - 3] = mod;
        this.modules[i % 3 + this.moduleCount - 8 - 3][Math.floor(i / 3)] = mod;
      }
    },
    mapData: function(data, maskPattern) {
      var inc = -1, row = this.moduleCount - 1, bitIndex = 7, byteIndex = 0;
      for (var col = this.moduleCount - 1; col > 0; col -= 2) {
        if (col == 6) col--;
        while (true) {
          for (var c = 0; c < 2; c++) {
            if (this.modules[row][col - c] == null) {
              var dark = false;
              if (byteIndex < data.length) {
                dark = (((data[byteIndex] >>> bitIndex) & 1) == 1);
              }
              var mask = QRUtil.getMask(maskPattern, row, col - c);
              if (mask) dark = !dark;
              this.modules[row][col - c] = dark;
              bitIndex--;
              if (bitIndex == -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || this.moduleCount <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
  };

  QRCodeModel.createData = function(typeNumber, errorCorrectLevel, dataList) {
    var rsBlocks = QRRSBlock.getRSBlocks(typeNumber, errorCorrectLevel);
    var buffer = new QRBitBuffer();
    for (var i = 0; i < dataList.length; i++) {
      var data = dataList[i];
      buffer.put(data.mode, 4);
      buffer.put(data.getLength(), 8);
      data.write(buffer);
    }
    var totalDataCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalDataCount += rsBlocks[i].dataCount;
    if (buffer.length + 4 <= totalDataCount * 8) buffer.put(0, 4);
    while (buffer.length % 8 != 0) buffer.putBit(false);
    while (true) {
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0xec, 8);
      if (buffer.length >= totalDataCount * 8) break;
      buffer.put(0x11, 8);
    }
    return QRCodeModel.createBytes(buffer, rsBlocks);
  };

  QRCodeModel.createBytes = function(buffer, rsBlocks) {
    var offset = 0, maxDcCount = 0, maxEcCount = 0;
    var dcdata = new Array(rsBlocks.length), ecdata = new Array(rsBlocks.length);
    for (var r = 0; r < rsBlocks.length; r++) {
      var dcCount = rsBlocks[r].dataCount, ecCount = rsBlocks[r].totalCount - dcCount;
      maxDcCount = Math.max(maxDcCount, dcCount);
      maxEcCount = Math.max(maxEcCount, ecCount);
      dcdata[r] = new Array(dcCount);
      for (var i = 0; i < dcdata[r].length; i++) dcdata[r][i] = 0xff & buffer.buffer[i + offset];
      offset += dcCount;
      var rsPoly = QRUtil.getErrorCorrectPolynomial(ecCount);
      var rawPoly = new QRPolynomial(dcdata[r], rsPoly.getLength() - 1);
      var modPoly = rawPoly.mod(rsPoly);
      ecdata[r] = new Array(rsPoly.getLength() - 1);
      for (var i = 0; i < ecdata[r].length; i++) {
        var modIndex = i + modPoly.getLength() - ecdata[r].length;
        ecdata[r][i] = (modIndex >= 0) ? modPoly.get(modIndex) : 0;
      }
    }
    var totalCodeCount = 0;
    for (var i = 0; i < rsBlocks.length; i++) totalCodeCount += rsBlocks[i].totalCount;
    var data = new Array(totalCodeCount), index = 0;
    for (var i = 0; i < maxDcCount; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < dcdata[r].length) data[index++] = dcdata[r][i];
      }
    }
    for (var i = 0; i < maxEcCount; i++) {
      for (var r = 0; r < rsBlocks.length; r++) {
        if (i < ecdata[r].length) data[index++] = ecdata[r][i];
      }
    }
    return data;
  };

  var QRUtil = {
    PATTERN_POSITION_TABLE: [
      [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34],
      [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50], [6, 30, 54]
    ],
    getBCHTypeInfo: function(data) {
      var d = data << 10;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(1335) >= 0) {
        d ^= (1335 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(1335)));
      }
      return ((data << 10) | d) ^ 21522;
    },
    getBCHTypeNumber: function(data) {
      var d = data << 12;
      while (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(7973) >= 0) {
        d ^= (7973 << (QRUtil.getBCHDigit(d) - QRUtil.getBCHDigit(7973)));
      }
      return (data << 12) | d;
    },
    getBCHDigit: function(data) {
      var digit = 0;
      while (data != 0) { digit++; data >>>= 1; }
      return digit;
    },
    getPatternPosition: function(typeNumber) {
      return QRUtil.PATTERN_POSITION_TABLE[typeNumber - 1] || [];
    },
    getMask: function(maskPattern, i, j) {
      switch (maskPattern) {
        case 0: return (i + j) % 2 == 0;
        case 1: return i % 2 == 0;
        case 2: return j % 3 == 0;
        case 3: return (i + j) % 3 == 0;
        case 4: return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 == 0;
        case 5: return (i * j) % 2 + (i * j) % 3 == 0;
        case 6: return ((i * j) % 2 + (i * j) % 3) % 2 == 0;
        case 7: return ((i * j) % 3 + (i + j) % 2) % 2 == 0;
        default: throw new Error("bad maskPattern:" + maskPattern);
      }
    },
    getErrorCorrectPolynomial: function(errorCorrectLength) {
      var a = new QRPolynomial([1], 0);
      for (var i = 0; i < errorCorrectLength; i++) {
        a = a.multiply(new QRPolynomial([1, QRMath.gexp(i)], 0));
      }
      return a;
    },
    getLostPoint: function(qrCode) {
      var moduleCount = qrCode.getModuleCount();
      var lostPoint = 0;
      for (var row = 0; row < moduleCount; row++) {
        for (var col = 0; col < moduleCount; col++) {
          var sameCount = 0, dark = qrCode.isDark(row, col);
          for (var r = -1; r <= 1; r++) {
            if (row + r < 0 || moduleCount <= row + r) continue;
            for (var c = -1; c <= 1; c++) {
              if (col + c < 0 || moduleCount <= col + c) continue;
              if (r == 0 && c == 0) continue;
              if (dark == qrCode.isDark(row + r, col + c)) sameCount++;
            }
          }
          if (sameCount > 5) lostPoint += (3 + sameCount - 5);
        }
      }
      return lostPoint;
    }
  };

  return {
    renderCanvas: function(text, canvas, size) {
      size = size || 180;
      var qr = new QRCodeModel(0, 1); // Auto version, ECC Level L (highest capacity)
      qr.addData(text);
      qr.make();
      var count = qr.getModuleCount();
      var ctx = canvas.getContext('2d');
      canvas.width = size;
      canvas.height = size;
      var cellSize = size / count;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      for (var r = 0; r < count; r++) {
        for (var c = 0; c < count; c++) {
          if (qr.isDark(r, c)) {
            var x = Math.round(c * cellSize);
            var y = Math.round(r * cellSize);
            var w = Math.ceil((c + 1) * cellSize) - x;
            var h = Math.ceil((r + 1) * cellSize) - y;
            ctx.fillRect(x, y, w, h);
          }
        }
      }
    }
  };
})();




// ==================== Unified Snap & Live Camera Viewfinder ====================
let currentSnapTab = 'camera';
const cameraBridge = {
  stream: null,
  active: false,
  targetSlot: 'top'
};

const snapBridge = {
  modalOpen: false,
  timerId: null,
  lastKnownPhotoId: -1,
  lanUrl: ''
};

function switchSnapTab(tab) {
  currentSnapTab = tab;
  const btnCam = document.getElementById('tabBtnCamera');
  const btnWifi = document.getElementById('tabBtnWifi');
  const panelCam = document.getElementById('tabPanelCamera');
  const panelWifi = document.getElementById('tabPanelWifi');

  if (tab === 'camera') {
    if (btnCam) btnCam.classList.add('active');
    if (btnWifi) btnWifi.classList.remove('active');
    if (panelCam) panelCam.classList.add('active');
    if (panelWifi) panelWifi.classList.remove('active');
    startCameraStream();
  } else {
    if (btnWifi) btnWifi.classList.add('active');
    if (btnCam) btnCam.classList.remove('active');
    if (panelWifi) panelWifi.classList.add('active');
    if (panelCam) panelCam.classList.remove('active');
    stopCameraStream();
    initSnapBridge();
  }
}

function openSnapModal(explicitSlot, initialTab) {
  const modal = document.getElementById('snapModalBack');
  if (!modal) return;
  modal.style.display = 'flex';
  snapBridge.modalOpen = true;

  // Update target slot labels
  const slot = explicitSlot || (typeof getTargetSlot === 'function' ? getTargetSlot() : 'top');
  cameraBridge.targetSlot = slot;
  const label = slot === 'top' ? 'Photo 1 (Top)' : 'Photo 2 (Side)';
  const lblEl = document.getElementById('snapTargetLabel');
  if (lblEl) lblEl.textContent = label;
  const slotBtnEl = document.getElementById('snapBtnSlotName');
  if (slotBtnEl) slotBtnEl.textContent = slot === 'top' ? 'Photo 1' : 'Photo 2';

  const helperEl = document.querySelector('#tabPanelCamera .viewfinder-helper span:last-child');
  if (helperEl) {
    if (slot === 'top') {
      helperEl.innerHTML = 'Place part face-up in corner with <b>USB / main port at TOP edge</b> and text right-side up.';
    } else {
      helperEl.innerHTML = 'Stand part on long edge against wall with soldered legs pointing <b>OUTWARD (away from wall)</b>.';
    }
  }

  // Use requested tab or default to 'wifi' (Phone QR) for EvenUCan
  switchSnapTab(initialTab || 'wifi');
}

function closeSnapModal() {
  const modal = document.getElementById('snapModalBack');
  if (modal) modal.style.display = 'none';
  snapBridge.modalOpen = false;
  stopCameraStream();
  if (snapBridge.timerId) {
    clearInterval(snapBridge.timerId);
    snapBridge.timerId = null;
  }
}

function openEucSnapModal(slot, initialTab) {
  openSnapModal(slot, initialTab || 'wifi');
}

async function loadPhoto(targetSlot, fileOrBlob) {
  const url = (fileOrBlob instanceof Blob || fileOrBlob instanceof File)
    ? URL.createObjectURL(fileOrBlob)
    : (typeof fileOrBlob === 'string' ? fileOrBlob : '');
  if (!url) return;
  const im = new Image();
  im.onload = async () => {
    _snapInt.rawImg = im;
    _snapInt.photoKind = targetSlot || 'top';
    _snapInt.photoFrom = '';
    _snapInt.clicks = [];
    _snapInt.edMode = _snapInt.photoKind === 'top' ? 'corners' : 'side';
    _snapInt.renderEditor();
    await _snapInt.askHtml(_snapInt.photoKind === 'top'
      ? '<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click the <b>4 corners of the board</b> in the picture, in this order: <b>top-left, top-right, bottom-right, bottom-left</b>. That lines the photo up with the part\'s real size.</p>'
      : '<div class="kHead"><b>Line up the photo</b></div><p style="margin:0">It isn\'t used yet - click 5 points on the picture in order: the board\'s <b>left end</b> and <b>right end</b> (both at the bottom of the board), its <b>top surface</b>, the <b>top of the tallest part</b>, then the <b>bottom tip of any pins</b> underneath.</p>',
      ['Got it'], 0);
  };
  im.onerror = () => WF.flash('Could not read that picture');
  im.src = url;
}
window.loadPhoto = loadPhoto;

async function startCameraStream(preferredDeviceId) {
  const video = document.getElementById('cameraVideo');
  const select = document.getElementById('cameraDeviceSelect');
  const badge = document.getElementById('cameraResBadge');

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    if (badge) badge.textContent = 'Camera not supported in this browser';
    return;
  }

  stopCameraStream();

  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const videoDevices = devices.filter(d => d.kind === 'videoinput');
    if (select) {
      select.innerHTML = '';
      videoDevices.forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Camera ${idx + 1} (${dev.deviceId.slice(0, 8)}…)`;
        if (preferredDeviceId && dev.deviceId === preferredDeviceId) opt.selected = true;
        select.appendChild(opt);
      });
      select.onchange = () => startCameraStream(select.value);
    }

    const videoConstraints = {
      width: { ideal: 1920 },
      height: { ideal: 1080 }
    };
    if (preferredDeviceId) {
      videoConstraints.deviceId = { exact: preferredDeviceId };
    } else {
      videoConstraints.facingMode = { ideal: 'environment' };
    }

    const stream = await navigator.mediaDevices.getUserMedia({ video: videoConstraints });
    cameraBridge.stream = stream;
    cameraBridge.active = true;

    if (video) {
      video.srcObject = stream;
      await video.play().catch(() => {});
      const track = stream.getVideoTracks()[0];
      const settings = track ? track.getSettings() : {};
      const resText = (settings.width && settings.height) ? `${settings.width}×${settings.height} Live` : '1080p Live';
      if (badge) badge.textContent = `● ${resText}`;
    }
  } catch (err) {
    console.warn('getUserMedia stream error:', err);
    if (badge) badge.textContent = 'Camera unavailable';
  }
}

function stopCameraStream() {
  if (cameraBridge.stream) {
    cameraBridge.stream.getTracks().forEach(t => t.stop());
    cameraBridge.stream = null;
  }
  cameraBridge.active = false;
  const video = document.getElementById('cameraVideo');
  if (video) video.srcObject = null;
}

function triggerShutterFeedback(label) {
  const flash = document.getElementById('cameraShutterFlash');
  const toast = document.getElementById('cameraToast');
  if (flash) {
    flash.classList.remove('flashing');
    void flash.offsetWidth; // trigger reflow
    flash.classList.add('flashing');
    setTimeout(() => flash.classList.remove('flashing'), 320);
  }
  if (toast) {
    toast.textContent = `✓ Captured ${label}!`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 1600);
  }
}

async function captureLiveCameraPhoto() {
  const video = document.getElementById('cameraVideo');
  if (!video || !cameraBridge.active || !cameraBridge.stream) return;

  const targetSlot = cameraBridge.targetSlot || (typeof getTargetSlot === 'function' ? getTargetSlot() : 'top');
  const slotShortName = targetSlot === 'top' ? 'Photo 1' : 'Photo 2';
  const slotLabel = targetSlot === 'top' ? 'Photo 1 (Top)' : 'Photo 2 (Side)';

  // Visual shutter flash + confirmation toast
  triggerShutterFeedback(slotShortName);

  let photoBlob = null;
  const track = cameraBridge.stream.getVideoTracks()[0];

  // 1. High-res still capture via ImageCapture API directly from sensor
  if (window.ImageCapture && track && track.readyState === 'live') {
    try {
      const imageCapture = new ImageCapture(track);
      photoBlob = await imageCapture.takePhoto();
    } catch (err) {
      console.warn('ImageCapture.takePhoto() failed, falling back to canvas:', err);
    }
  }

  // 2. Clean fallback: grab full-resolution frame from video element
  if (!photoBlob) {
    const vw = video.videoWidth || 1920;
    const vh = video.videoHeight || 1080;
    const capCv = document.createElement('canvas');
    capCv.width = vw;
    capCv.height = vh;
    const ctx = capCv.getContext('2d');
    ctx.drawImage(video, 0, 0, vw, vh);

    photoBlob = await new Promise(resolve => capCv.toBlob(resolve, 'image/jpeg', 0.95));
  }

  if (!photoBlob) return;

  const file = new File([photoBlob], `camera_part_${Date.now()}.jpg`, { type: 'image/jpeg' });

  // Brief pause so user sees shutter flash and confirmation toast before modal dismisses
  await new Promise(r => setTimeout(r, 450));

  stopCameraStream();
  closeSnapModal();

  if (typeof loadPhoto === 'function') {
    await loadPhoto(targetSlot, file);
  } else if (typeof window.rawImg !== 'undefined') {
    const im = new Image();
    im.onload = () => {
      _snapInt.rawImg = im;
      _snapInt.photoKind = targetSlot;
      _snapInt.photoFrom = '';
      if (targetSlot === 'top' && typeof startCorners === 'function') startCorners();
      else if (typeof startSide === 'function') startSide();
    };
    im.src = URL.createObjectURL(photoBlob);
  }

  if (typeof showWatchBadge === 'function') {
    showWatchBadge(`Captured ${slotShortName} from camera into ${slotLabel}`, 'success', 8000);
  }
  if (typeof window.setHint === 'function') {
    _snapInt.setHint(`✓ Captured ${slotShortName} into ${slotLabel}`);
  }
  if (window.WF && window.WF.flash) {
    WF.flash(`Captured ${slotShortName} into ${slotLabel}`, 7000);
  }
}

async function initSnapBridge() {
  const canvas = document.getElementById('snapQrCanvas');
  const urlTxt = document.getElementById('snapUrlTxt');

  try {
    const res = await fetch('/api/ip');
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    const port = data.port || 8080;
    const ip = data.ip || window.location.hostname;
    snapBridge.lanUrl = 'http://' + ip + ':' + port + '/snap';
    if (urlTxt) urlTxt.textContent = snapBridge.lanUrl;

    if (canvas && window.QRCode) {
      QRCode.renderCanvas(snapBridge.lanUrl, canvas, 180);
    }
  } catch (e) {
    const fallbackUrl = window.location.origin + '/snap';
    snapBridge.lanUrl = fallbackUrl;
    if (urlTxt) urlTxt.textContent = fallbackUrl;
    if (canvas && window.QRCode) {
      QRCode.renderCanvas(fallbackUrl, canvas, 180);
    }
  }

  try {
    const res = await fetch('/api/latest-photo');
    if (res.ok) {
      const data = await res.json();
      if (snapBridge.lastKnownPhotoId === -1) {
        snapBridge.lastKnownPhotoId = data.id || 0;
      }
    }
  } catch (e) {}

  if (snapBridge.timerId) clearInterval(snapBridge.timerId);
  snapBridge.timerId = setInterval(pollLatestPhoto, 1000);
}

function dataURLtoFile(dataurl, filename) {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename || 'phone_snap.jpg', { type: mime });
}

let isPollingPhoto = false;
async function pollLatestPhoto() {
  if (!snapBridge.modalOpen || isPollingPhoto || currentSnapTab !== 'wifi') return;
  isPollingPhoto = true;
  try {
    const res = await fetch('/api/latest-photo?t=' + Date.now());
    if (!res.ok) return;
    const data = await res.json();

    if (data && data.id && data.id > snapBridge.lastKnownPhotoId && data.data_url) {
      snapBridge.lastKnownPhotoId = data.id;

      const targetSlot = cameraBridge.targetSlot || (typeof getTargetSlot === 'function' ? getTargetSlot() : 'top');
      const slotLabel = targetSlot === 'top' ? 'Photo 1 (Top)' : 'Photo 2 (Side)';

      const fileObj = dataURLtoFile(data.data_url, data.filename || `snap_${data.id}.jpg`);
      if (typeof loadPhoto === 'function') {
        await loadPhoto(targetSlot, fileObj);
      } else if (typeof window.rawImg !== 'undefined') {
        const im = new Image();
        im.onload = () => {
          _snapInt.rawImg = im;
          _snapInt.photoKind = targetSlot;
          _snapInt.photoFrom = '';
          if (targetSlot === 'top' && typeof startCorners === 'function') startCorners();
          else if (typeof startSide === 'function') startSide();
        };
        im.src = data.data_url;
      }

      const statusMsg = `Received photo #${data.id} from phone into ${slotLabel}`;
      if (typeof showWatchBadge === 'function') showWatchBadge(statusMsg, 'success', 8000);
      if (typeof window.setHint === 'function') window.setHint('✓ ' + statusMsg);
      if (window.WF && window.WF.flash) WF.flash(statusMsg, 7000);

      const pollTxt = document.getElementById('snapPollText');
      if (pollTxt) pollTxt.textContent = `✓ Loaded into ${slotLabel}! Ready for next photo.`;
    }
  } catch (err) {
    console.warn('Error polling /api/latest-photo:', err);
  } finally {
    isPollingPhoto = false;
  }
}

// Initialize DOM listeners
window.addEventListener('DOMContentLoaded', () => {
  const snapBtn = document.getElementById('cameraSnapBtn');
  if (snapBtn) snapBtn.onclick = captureLiveCameraPhoto;
  const closeBtn = document.getElementById('snapModalClose');
  if (closeBtn) closeBtn.onclick = closeSnapModal;
  const back = document.getElementById('snapModalBack');
  if (back) {
    back.onclick = (e) => {
      if (e.target === back) closeSnapModal();
    };
  }
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && snapBridge.modalOpen) {
    closeSnapModal();
  }
});

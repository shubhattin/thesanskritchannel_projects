mtr = {
    "A": "𑀸",
    "A1": "𑀹",
    "I": "𑀻",
    "LR": "𑁀",
    "LRR": "𑁁",
    "R": "𑀾",
    "RR": "𑀿",
    "U": "𑀽",
    "a": "",
    "ai": "𑁃",
    "au": "𑁅",
    "e": "𑁂",
    "i": "𑀺",
    "o": "𑁄",
    "u": "𑀼",
}

m = {
    "range": [[0x11000, 0x1107F]],
    "sa": 1,
    # अ, आ, ऐ, औ
    "a": {
        "a": ["𑀅", "", "aiu", 0],
        "ai": ["𑀐", mtr["ai"], "", 0],
        "au": ["𑀒", mtr["au"], "", 0],
    },
    # आ, ऑ, ॐ
    "A": {
        "A": ["𑀆", mtr["A"], "U", 0],
        "AU": ["", "M", 2],
        "AUM": ["ॐ", "", 2],
    },
    # इ, ई
    "i": {"i": ["𑀇", mtr["i"], "i", 0]},
    # ई, ऌ, ॡ
    "I": {"I": ["𑀈", mtr["I"], "", 0]},
    # उ, ऊ
    "u": {"u": ["𑀉", mtr["u"], "u", 0]},
    # ऊ
    "U": {"U": ["𑀊", mtr["U"], "", 0]},
    # ए, ऐ
    "e": {"e": ["𑀏", mtr["e"], "e", 0]},
    # ओ, औ
    "o": {"o": ["𑀑", mtr["o"], "o", 0]},
    # ऋ, ॠ
    "R": {
        "R": ["𑀋", mtr["R"], "R", 0],
        "RR": ["𑀌", mtr["RR"], "", 0],
    },
    # # क वर्ग
    "k": {"k": ["𑀓", "h", 1], "kh": ["𑀔", "", 1]},
    "g": {"g": ["𑀕", "h", 1], "gh": ["𑀖", "", 1]},
    "G": {"G": ["𑀗", "", 1]},
    # # च वर्ग
    "C": {"C": ["𑀘", "h", 1], "Ch": ["𑀙", "", 1]},
    "j": {"j": ["𑀚", "h", 1], "jh": ["𑀛", "", 1]},
    "Y": {"Y": ["𑀜", "", 1]},
    # त वर्ग
    "t": {"t": ["𑀢", "h", 1], "th": ["𑀣", "", 1]},
    "d": {"d": ["𑀤", "h", 1], "dh": ["𑀥", "", 1]},
    "n": {"n": ["𑀦", "z", 1], "nz": ["𑀷", "", 1]},
    # # ट वर्ग
    "T": {"T": ["𑀝", "h", 1], "Th": ["𑀞", "", 1]},
    "D": {"D": ["𑀟", "h", 1], "Dh": ["𑀠", "", 1]},
    "N": {"N": ["𑀡", "", 1]},
    # प वर्ग
    "p": {"p": ["𑀧", "h", 1], "ph": ["𑀨", "", 1]},
    "b": {"b": ["𑀩", "h", 1], "bh": ["𑀪", "", 1]},
    "m": {"m": ["𑀫", "", 1]},
    # अन्तस्थ व्यञ्जन
    "y": {"y": ["𑀬", "", 1]},
    "v": {"v": ["𑀯", "", 1]},
    "r": {"r": ["𑀭", "z", 1], "rz": ["𑀶", "", 1]},
    "l": {"l": ["𑀮", "", 1]},
    # ऊष्ण व्यञ्जन
    "h": {"h": ["𑀳", "", 1]},
    "s": {"s": ["𑀲", "h", 1], "sh": ["𑀰", "h", 1], "shh": ["𑀱", "", 1]},
    "S": {"S": ["S", "h", 2], "Sh": ["𑀱", "", 1]},
    "L": {
        "L": ["𑀴", "Rz", 1],
        "LR": ["𑀍", mtr["LR"], "R", 0],
        "LRR": ["𑀎", mtr["LRR"], "", 0],
        "Lz": ["𑀵", "", 1],
    },
    # अन्योविशिष्टश्च
    "M": {"M": ["𑀁", "M", 2], "MM": ["𑀀", "", 2]},
    "H": {"H": ["𑀂", "", 2]},
    "$": {"$": ["$", "$", 2], "$$": ["₹", "", 2]},
    "Q": {"Q": ["॰", "Q", 2], "QQ": ["ऽ", "", 2]},
    "q": {
        "q": ["q", "q", 2],
        "qq": ["𑁆", "", 2],
    },  # \u200c and d
    "#": {"#": ["#", "H", 2], "#H": ["𑀃", "1", 2], "#H1": ["𑀄", "", 2]},
    ".": {
        ".": ["।", ".1234567890aAiIuUeoRL", 2],
        "..": ["॥", "", 2],
        ".0": ["𑁦", "", 2],
        ".1": ["𑁧", "", 2],
        ".2": ["𑁨", "", 2],
        ".3": ["𑁩", "", 2],
        ".4": ["𑁪", "", 2],
        ".5": ["𑁫", "", 2],
        ".6": ["𑁬", "", 2],
        ".7": ["𑁭", "", 2],
        ".8": ["𑁮", "", 2],
        ".9": ["𑁯", "", 2],
        ".a": ["", "aiu", 2],
        ".A": ["", "1", 2],
        ".A1": [mtr["A1"], "", 2],
        ".i": ["", "i", 2],
        ".u": ["", "u", 2],
        ".e": ["", "e", 2],
        ".o": ["", "o", 2],
        ".L": [".L", "R", 2],
        ".LR": ["", "R", 2],
        ".R": ["", "R", 2],
    },
}

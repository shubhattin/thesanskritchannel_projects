import unicodedata
import json

from dattAMsh import a
import shubhlipi as sh

c = 0


def update(key, val, ind, updt=True):
    obj = c[key[0]][key]
    if updt:
        obj[ind] += val
    else:
        obj[ind] = val


def add(key, val="", ind=None):
    if ind == None:
        if sh.get_type(key) != "dict":
            c[key[0]][key] = val
        else:
            for t in key:
                ob = c[t[0]]
                ob[t] = key[t]
    else:
        c[key[0]][key][ind] = val


def get(key, ind=None):
    obj = c[key[0]][key]
    if ind != None:
        return obj[ind]
    return obj


for lang in a:
    c = a[lang]
    update(".", "q", -2)
    add(".q", ["\u200c", "1", 2])
    add(".q1", ["\u200d", "", 2])
    update("q", ".", -2)
    c["q"]["q."] = [".", "", 2]
    if "n" not in get(".", -2):
        update(".", "n", -2)
        add(
            {
                ".n": [".n", "234", 2],
                ".n2": ["²", "", 2],
                ".n3": ["³", "", 2],
                ".n4": ["⁴", "", 2],
            }
        )
    else:
        update(".n", "234", -2)
        if lang == "Tamil-Extended":
            update(".n", "x", -2)
            add(
                {
                    ".nx": [".nx", "234", 2],
                    ".nx2": ["₂", "", 2],
                    ".nx3": ["₃", "", 2],
                    ".nx4": ["₄", "", 2],
                }
            )
        add({".n2": ["²", "", 2], ".n3": ["³", "", 2], ".n4": ["⁴", "", 2]})
    if True:  # Devanagari OM addition ans 卐(swastik) addition
        if "AUM" in c["A"]:
            if get("AUM", 0) != "ॐ":
                update("AUM", "12", -2)
                add({"AUM1": ["ॐ", "", 2], "AUM2": ["卐", "", 2]})
            else:
                update("AUM", "1", -2)
                add("AUM1", ["卐", "", 2])
        # 卐
        update("S", "W", -2)
        add({"SW": ["SW", "S", 2], "SWS": ["卐", "", 2]})
    if lang == "Urdu":
        continue

    def there(d):
        if len(d) == 1:
            return True
        if d[1] in c[d[0]][d[0]][-2]:
            if d in c[d[0]]:
                if c[d[0]][d][0] == "":
                    return True
                else:
                    return False
            else:
                return True
        else:
            return False

    ADD = {
        "A": ["aa", ".A", ".aa"],
        "i": [".i"],
        "I": ["ee", "ii", ".I", ".ii", ".ee"],
        "U": ["uu", "oo", ".U", ".uu", ".oo"],
        "u": [".u"],
        "e": [".e"],
        "E": [".E"],
        "o": [".o"],
        "O": [".O"],
        "ai": [".ai"],
        "au": [".au"],
        "R": [".R"],
        "RR": [".RR"],
        "LR": [".LR"],
        "LRR": [".LRR"],
        "ph": ["f"],
    }
    for t in ADD:
        for y in ADD[t]:
            if t in ["ph"] and lang == "Romanized":
                continue
            elif t in ["R", "RR", "LR", "LRR"] and lang == "Punjabi":
                continue
            if y[0] not in c:
                c[y[0]] = {}
            if there(y):
                if y in c[y[0]]:
                    if c[y[0]][y][0] == "":
                        rec = c[y[0]][y][-2]
                        c[y[0]][y] = sh.deepcopy(c[t[0]][t])
                        c[y[0]][y][-2] = rec
                        if c[y[0]][y][-1] == 0 and y[0] == ".":
                            c[y[0]][y][-1] = 2
                            c[y[0]][y].pop(0)
                else:
                    c[y[0]][y] = sh.deepcopy(c[t[0]][t])
                    c[y[0]][y][-2] = ""
                    if c[y[0]][y][-1] == 0 and y[0] == ".":
                        c[y[0]][y][-1] = 2
                        c[y[0]][y].pop(0)
    # J -> Y Addition
    if "J" not in c:
        c["J"] = {"J": sh.deepcopy(get("Y"))}
        get("J")[-2] = ""
    # AU addition
    if get("AU", 0) == "":
        get("AU")[0] = get("A", 0) + get("U", 0)
    # N  addition
    update("n", "1234", -2)
    if "Tamil" != lang:
        add("n1", [c["M"]["M"][0], "", 2])
    add(
        {
            "n2": [get("N", 0), "", 1],
            "n3": [get("G", 0), "", 1],
            "n4": [get("Y", 0), "", 1],
        }
    )
    update("m", "1", -2)
    add("m1", [get("M", 0), "m" if "MM" in c["M"] else "", 2])
    if "MM" in c["M"]:
        add("m1m", [get("MM", 0), "", 2])
        update("M", "1", -2)
        add("M1", [get("MM", 0), "", 2])
    # addition of Bindu and Visarga
    ADD = {"G": "M", "Y": "M", "J": "M", "N": "M", "h": "H"}
    for t in ADD:
        update(t, "1", -2)
        add(t + "1", [get(ADD[t], 0), "", 2])
    # Short O and E
    ADD = {"o": "O", "e": "E"}
    for t in ADD:
        if ADD[t] in c:
            update(t, "2", -2)
            add(t + "2", [get(ADD[t], 0), get(ADD[t], 1), "", 0])
    # T,Th,D,Dh addition
    update("t", "1", -2)
    add("t1", [get("T", 0), "", get("T", -1)])
    update("d", "1", -2)
    add("d1", [get("D", 0), "", get("D", -1)])
    # l1 as L addition
    if "L" in c and lang != "Bengali":
        get("l")[-2] += "1"
        add("l1", [get("L", 0), "", 1])
    if lang != "Romanized":
        # kSh -> x Addition
        if "x" not in c:
            c["x"] = {"x": [get("k", 0) + get("qq", 0) + get("Sh", 0), "", 1]}
        # '' -> Avagraha Addition
        if "'" not in c:
            c["'"] = {
                "'": ["'", "'", 2],
                "''": [get("QQ", 0), "", 2],
            }
        # w -> v Addition
        if "w" not in c:
            c["w"] = {"w": sh.deepcopy(get("v"))}
            get("w")[-2] = ""
        # Th,Th extension
        get("th")[-2] += "1"
        get("dh")[-2] += "1"
        add(
            {
                "th1": [get("Th", 0), "", get("Th", -1)],
                "dh1": [get("Dh", 0), "", get("Dh", -1)],
            }
        )
        # E Addition
        get("e")[-2] += "1"
        get("o")[-2] += "1"
        add(
            {
                "e1": [get("ai", 0), get("ai", 1), "", 0],
                "o1": [get("au", 0), get("au", 1), "", 0],
            }
        )
        # .x adddition
        get(".")[-2] = "x" + get(".", -2)
        c["."][".x"] = [get("qq", 0), "", 2]
        if ".z" in c["."]:
            nukta = get(".z", 0)
            # Cz addition to C
            if "Cz" not in c["C"]:
                get("C")[-2] += "z"
                add("Cz", [get("C", 0) + nukta, "", 1])
            # Chz addition to C
            if "Chz" not in c["C"]:
                get("Ch")[-2] += "z"
                add("Chz", [get("Ch", 0) + nukta, "", 1])
            # Dz and Dhz addition to r and d
            get("r")[-2] += "1"
            get("d")[-2] += "2"
            g = ""
            if "Dz" in c["D"]:
                g = get("Dz", 0)
            else:
                g = get("D", 0) + nukta
            add({"r1": [g, "h", 1], "d2": [g, "", 1]})
            if "Dhz" in c["D"]:
                g = get("Dhz", 0)
            else:
                g = get("Dh", 0) + nukta
            get("dh")[-2] += "2"
            add({"r1h": [g, "", 1], "dh2": [g, "", 1]})
            # khz, kz addition to K
            if "kz" not in c["k"]:
                get("k")[-2] += "z"
                add("kz", [get("k", 0) + nukta, "", 1])
            if "khz" not in c["k"]:
                get("kh")[-2] += "z"
                add("khz", [get("kh", 0) + nukta, "", 1])
            # gz addition to g
            if "gz" not in c["g"]:
                get("g")[-2] += "z"
                add("gz", [get("g", 0) + nukta, "", 1])
            # jz addition to j
            if "jz" not in c["j"]:
                get("j")[-2] += "z"
                add("jz", [get("j", 0) + nukta, "", 1])
            # z addition
            if "z" not in c:
                c["z"] = {}
                add("z", [get("jz", 0), "", 1])
            else:
                get("z")[0] = get("jz", 0)
                get("z")[2] = 1
            # nz addition to n
            if "nz" not in c["n"]:
                get("n")[-2] += "z"
                add("nz", [get("n", 0) + nukta, "", 1])
            # Dz addition to D
            if "Dz" not in c["D"]:
                get("D")[-2] += "z"
                add("Dz", [get("D", 0) + nukta, "", 1])
            # Dhz addition to D
            if "Dhz" not in c["D"]:
                get("Dh")[-2] += "z"
                add("Dhz", [get("Dh", 0) + nukta, "", 1])
            # phz and  fz addition to D
            if "phz" not in c["p"]:
                get("ph")[-2] += "z"
                add("phz", [get("ph", 0) + nukta, "", 1])
            if "fz" not in c["f"]:
                get("f")[-2] += "z"
                add("fz", [get("f", 0) + nukta, "", 1])
            # yz addition to y
            if "yz" not in c["y"]:
                get("y")[-2] += "z"
                add("yz", [get("y", 0) + nukta, "", 1])
            # rz addition to r
            if "rz" not in c["r"]:
                get("r")[-2] += "z"
                add("rz", [get("r", 0) + nukta, "", 1])
            # Lz addition to l
            if "L" in c and lang not in ("Bengali", "Punjabi"):
                if "Lz" not in c["L"]:
                    get("L")[-2] += "z"
                    add("Lz", [c["L"]["L"][0] + nukta, "", 1])
        # Copying of C to ch
        if True:
            c["c"] = {"c": ["c", "h", 2]}
            t1 = sh.deepcopy(c["C"])
            for t in t1:
                c["c"][t.replace("C", "ch")] = sh.deepcopy(t1[t])
    if "R" in c:
        get("r")[-2] += "3"
        if lang in ("Romanized", "Tamil", "Tamil-Extended", "Punjabi", "Urdu"):
            add("r3", [get("R", 0), "", 2])
        else:
            add("r3", [get("R", 0), get("R", 1), "", 0])
        if "R" in get("R")[-2]:
            get("r3")[-2] += "r"
            if lang in ("Romanized", "Tamil", "Tamil-Extended", "Punjabi"):
                add("r3r", [get("RR", 0), "", 2])
            else:
                add("r3r", [get("RR", 0), get("RR", 1), "", 0])
    if lang not in ["Sharada", "Modi", "Brahmi", "Siddham", "Granth", "Romanized"]:
        if "#" not in c:
            c["#"] = {}
        if "#" not in c["#"]:
            add("#", ["#", "as", 2])
        elif "as" not in get("#")[-2]:
            get("#")[-2] += "as"
        if lang != "Sanskrit":
            add("#a", ["#a", "n", 2])
        add(
            {
                "#an": ["॒", "1", 2],
                "#s": ["॑", "s1", 2],
                "#ss": ["᳚", "s1", 2],
                "#sss": ["᳛", "1", 2],
                "#an1": ["↓", "", 2],
                "#s1": ["↑", "", 2],
                "#ss1": ["↑↑", "", 2],
                "#sss1": ["↑↑↑", "", 2],
            }
        )
    else:
        c["#"] = {}
        add(
            {
                "#": ["#", "as", 2],
                "#a": ["#a", "n", 2],
                "#an": ["↓", "", 2],
                "#s": ["↑", "s", 2],
                "#ss": ["↑↑", "s", 2],
                "#sss": ["↑↑↑", "", 2],
            }
        )

akSharAH = a

sarve_bhAShA = []
for lang in akSharAH:
    if lang == "prayog":
        continue
    for aplph in akSharAH[lang]:
        if not aplph.isascii() or len(aplph) > 1:
            continue
        sarve_bhAShA.append(aplph)
        for varna in akSharAH[lang][aplph]:
            sarve_bhAShA.append(varna)
if True:
    from anukAraH import anukarah

    akSharAH = anukarah(akSharAH)

sh.makedir("dattAMsh/ascii")


def sort_dict(ln):
    ord = "range,sa,a,A,i,I,u,U,e,E,o,O,R"
    ord += ",k,g,G,c,C,j,J,Y,T,D,N,t,d,n,p,f,b,m"
    ord += ",x,y,r,l,L,v,w,h,s,S,z"
    ord += ",M,H,Q,',$,q,.,#,antar,kram"
    ord = ord.split(",")
    r = {}
    ak = sh.deepcopy(akSharAH[ln])
    for x in ord:
        if x in ak:
            r[x] = ak[x]
            del akSharAH[ln][x]
    for x in akSharAH[ln]:
        r[x] = ak[x]
    return r


for x in akSharAH:
    akSharAH[x] = sort_dict(x)
for x in akSharAH:
    d = sh.dump_json([akSharAH[x]])
    chng = {
        "[\n                ": "[",
        ",\n                ": ", ",
        "\n            ],": "],",
        "\n            ],": "],",
        "\n            ]": "]",
    }
    for y in chng:
        d = d.replace(y, chng[y])
    sh.write(f"../src/tools/converter/resources/dattAMsh/{x}.json", d)
    # only ASCII databases
    d = json.dumps(akSharAH[x], indent=4)
    chng = {
        "[\n                ": "[",
        ",\n                ": ", ",
        "\n            ],": "],",
        "\n            ],": "],",
        "\n            ]": "]",
    }
    for y in chng:
        d = d.replace(y, chng[y])
    sh.write(f"dattAMsh/ascii/{x}.json", d)
    # sh.write(
    #     f"dattAMsh\\ascii\\{x}.json",
    #     d.encode("ascii", "backslashreplace").decode("utf-8"),
    # )
main = akSharAH


class VAL:
    def __init__(self):
        self.val = ""


val = VAL()
for x in main:
    for y in main[x]:
        p = main[x][y]
        temp = set()
        l = True
        if len(y) > 1 or not y.isascii():
            continue
        for m in p:
            if l:
                temp.add(m)
                l = False
                val.val = m
            next_chsrs = p[m][-2]
            if p[m][-1] not in (0, 1, 2, 3):
                print("Invalid Group ID in ", x, y, m, end="\t")
                input("fix !!!")
            if len(p[m]) != 3 + (1 if p[m][-1] == 0 else 0):
                print("Invalid Group Stregnth in ", x, y, m, end="\t")
                input("fix !!!")
            for n in next_chsrs:
                if m + n not in p:
                    print(
                        "Unused 'next' chars assigned in ", x, val.val, m, n, end="\t"
                    )
                    input("Fix !!!")
                else:
                    temp.add(m + n)
        for g in p:
            if g not in temp:
                print("Character Not Mapped in ", x, val.val, g, end="\t")
                input("Fix !!!")

import os, shubhlipi as sh
from importlib import import_module

a = {}


def add_dict(v, dc):
    for x in v:
        dc[x] = v[x]
    return dc


mAtrA = {}

for x in os.listdir("dattAMsh"):
    if x in ("__pycache__", "__init__.py", "ascii", "table"):
        continue
    v = x[:-3]
    nm = v.replace("_", "-")
    md = import_module(f"dattAMsh.{v}")
    a[nm] = md.m
    mAtrA[nm] = md.mtr
if True:  # Hindi, Marathi, Konkani, Nepali -> Sanskrit
    for x in ["Hindi", "Marathi", "Konkani", "Nepali", "Sindhi"]:
        t1 = sh.deepcopy(a["Sanskrit"])
        t1["sa"] = 0
        a[x] = t1
        a[x]["range"].pop()
        a[x]["range"].pop()
if True:  # Kashmiri -> Purna Devanagari
    for x in ["Kashmiri"]:
        t1 = sh.deepcopy(a["Purna-Devanagari"])
        t1["sa"] = 0
        a[x] = t1
        a[x]["range"].pop()
        a[x]["range"].pop()
if True:  # Adding changes to Sindhi
    t1 = a["Sindhi"]
    t2 = a["Purna-Devanagari"]
    t1["g"]["g"][-2] += "1"
    t1["j"]["j"][-2] += "1"
    t1["D"]["D"][-2] += "1"
    t1["b"]["b"][-2] += "1"
    t1["g"]["g1"] = [t2["g"]["g1"][0], "", 1]
    t1["j"]["j1"] = [t2["j"]["j1"][0], "", 1]
    t1["D"]["D1"] = [t2["D"]["D1"][0], "", 1]
    t1["b"]["b1"] = [t2["b"]["b1"][0], "", 1]
if True:  # Making changes to Kashmiri
    t1 = a["Kashmiri"]
    t1["g"]["g"][-2] = t1["g"]["g"][-2].replace("1", "")
    t1["j"]["j"][-2] = t1["j"]["j"][-2].replace("1", "")
    t1["D"]["D"][-2] = t1["D"]["D"][-2].replace("1", "")
    t1["b"]["b"][-2] = t1["b"]["b"][-2].replace("1", "")
    t1["z"]["z"][-2] = t1["z"]["z"][-2].replace("h", "")
    del t1["g"]["g1"]
    del t1["j"]["j1"]
    del t1["D"]["D1"]
    del t1["b"]["b1"]
    del t1["z"]["zh"]
if True:  # Assamese -> Bengali
    a["Assamese"] = sh.deepcopy(a["Bengali"])
    a["Assamese"]["v"]["v"][0] = "ৱ"
    a["Assamese"]["r"]["r"][0] = "ৰ"
if True:  # Additions to Sanskrit
    b = a["Sanskrit"]
    b["#"] = {"#": ["#", "", 2]}
    b["#"]["#"][-2] += "as0123456789'MukrvpnH"
    add_sa = {
        "#a": ["꣪", "n", 2],
        "#an": ["॒", "1", 2],
        "#s": ["॑", "s1", 2],
        "#ss": ["᳚", "s1", 2],
        "#sss": ["᳛", "1", 2],
        "#0": ["꣠", "", 2],
        "#1": ["꣡", "", 2],
        "#2": ["꣢", "", 2],
        "#3": ["꣣", "", 2],
        "#4": ["꣤", "", 2],
        "#5": ["꣥", "", 2],
        "#6": ["꣦", "", 2],
        "#7": ["꣧", "", 2],
        "#8": ["꣨", "", 2],
        "#9": ["꣩", "", 2],
        "#'": ["꣱", "", 2],
        "#M": ["ꣳ", "1", 2],
        "#M1": ["ꣲ", "", 2],
        "#u": ["꣫", "", 2],
        "#k": ["꣬", "", 2],
        "#n": ["꣭", "", 2],
        "#p": ["꣮", "", 2],
        "#r": ["꣯", "", 2],
        "#v": ["꣰", "", 2],
        "#H": ["ᳵ", "1", 2],
        "#H1": ["ᳶ", "", 2],
    }
    for x in add_sa:
        b[x[0]][x] = add_sa[x]

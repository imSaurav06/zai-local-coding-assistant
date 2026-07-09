with open('services/validationProfiles.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Line 360 (0-indexed = 359)
print("BEFORE:", repr(lines[359]))

bad = "/import\\s+App\\s+from/i.test(mainFile.content) || /require\\(['\"]\\.\\\\/App/i.test(mainFile.content);"
good = '/import\\s+App\\s+from/i.test(mainFile.content) || mainFile.content.includes("require(\'./App") || mainFile.content.includes(\'require("./App\');'

lines[359] = lines[359].replace(bad, good)
print("AFTER: ", repr(lines[359]))

with open('services/validationProfiles.js', 'w', encoding='utf-8') as f:
    f.writelines(lines)
print("Written!")

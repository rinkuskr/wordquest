/**
 * Small, local, curated bonus-word vocabulary. This is not a complete English
 * dictionary. Puzzle category words are checked separately.
 */
const entries = `
ace act add age ago aid aim air all and ant any apt arc are arm art ash ask
ate aunt awe axe bad bag ban bar bat bay bed bee beg bet bid big bin bit boa
bob bog boo bow box boy bud bug bun bus but buy cab can cap car cat cob cod
cop cow cry cub cue cup cut dad dam day den dew did dig dim dip dog dot dry
due dug ear eat eel egg ego elf elk end era eve eye fan far fat fax fed fee
few fig fin fit fix flu fly fog for fox fry fun fur gap gas gel gem get gig
gin god got gum gun guy gym had ham has hat hay her hid him hip his hit hog
hop hot how hub hue hug hum hut ice icy ill ink inn ion its ivy jam jar jaw
jet job jog joy key kid kin kit lab lad lag lap law lay led leg let lid lie
lip lit log lot low mad man map mat may men met mix mob mom mop mud mug nag
nap net new nod nor not now nut oak oar oat odd off oil old one opt orb ore
our out owe owl own pad pal pan par pat paw pay pea peg pen pet pew pie pig
pin pit ply pod pop pot pro pub pun pup pus put rag ram ran rap rat raw ray
red rib rid rig rim rip rob rod roe rot row rub rue rug rum run rut rye sad
sag sap sat saw say sea set sew sex she shy sin sip sir sit six ski sky sly
sob son sow spa spy sub sue sum sun tab tad tag tan tap tar tax tea ten the
tho tie tin tip toe ton too top tow toy try tub tug two use van vat vet vex
via vie vow war was wax way web wed wet who why wig win wit wok won woo wow
yam yap yaw yea yes yet you zip zoo
able acid acre aged also ante arch area army atom aunt auto away axis baby back
bait bake bald ball band bang bank bare bark barn base bath bead beam bean bear
beat beef been beep beer bell belt bent best bias bike bill bind bird bite blue
blow blue blur boat body bold bolt bomb bond bone book boom boot born boss both
bowl bulk burn bury bush busy byte cake call calm came camp card care cart case
cash cast cave cell cent chat chef chew chin chip chop city clap clay clip club
clue coal coat code coil coin cold come cook cool copy cord core cork cost cozy
crew crop crow cube curl cute dark dart data date dawn days dead deaf deal dear
debt deck deed deep deer desk dial dice diet dirt dive dock does doll dome done
door dose down draw drew drop drum dual duck duct dull duly dust duty each earn
ease east easy edge edit else emit envy epic even ever evil exam exit face fact
fade fail fair fall fame fang fare farm fast fate fear feed feel feet fell felt
file fill film find fine fire firm fish fist five flag flat flaw flea flew flex
flip flow flux foam fold folk food foot ford form fort four free frog from fuel
full fund fury fuse gain gale game gang gate gave gaze gear geek gene gift girl
give glad goal goat goes gold golf gone good gray grew grid grim grip grit grow
gulf guru hair half hall halt hand hang hard hare harm harp hash hate have hawk
head heal heap hear heat heel held hell help herb here hero hide high hike hill
hint hire hold hole holy home hood hook hope horn host hour huge hung hunt hurt
icon idea idle inch info iron item jack jade jail jazz join joke jolt jump jury
just keen keep kept kick kids kill kind king kiss kite knew knee knit knob knot
know lace lack lady laid lake lamp land lane last late lazy lead leaf leak lean
leap left lend lens less lest life lift like lily limb lime limp line link lion
list live load loaf loan lock logo lone long look loop lord lose loss lost lots
loud love luck lump lung lush made mail main make male mall many mark mass mate
math meal mean meat meet melt memo menu mere mesh mess mild mile milk mill mind
mine mint miss mist mode mood moon more most moth move much mule muse mush must
myth nail name navy near neat neck need nest news next nice nick nine node none
noon nose note okay once only onto open oral over pace pack page paid pain pair
pale palm park part pass past path pave peak pear peck peek peel peer pick pile
pill pine pink pint pipe plan play plea plot plug plum plus poem poet pole poll
polo pond pool poor port pose post pour pray prey prim prod prop pull pulp pump
pure push quit race rack race rack rail rain rank rare rate rats read real reap
rear reed reel rein rely rent rest rice rich ride ring rink rise risk road roam
roar rock rode role roll roof room root rope rose rowl ruby rude ruin rule rush
rust safe said sail sake sale salt same sand sane sang sank save scan scar seal
seam seat seed seek seem seen self sell send sent sept sets ship shop shot show
shut sick side sign silk silk silo sink site size skew skis skin skip slam slap
slat sled slim slip slot slow slug snap snow soap soak soar sock soft soil sold
sole some song soon sort soul soup sour span spin spit spot star stay stem step
stew stop stub such suit sure surf swam swap swan sway swim tack tail take tale
talk tall tame tank tape task team tear tech tell tend tent term test text than
that them then they thin this thus tick tide tidy tied tier tile till tilt time
tiny tire told toll tone took tool tour town trap tree trek trim trip true tube
tuck tune turn twin type unit upon used user vale vast veal verb very vest view
vine visa void vote wage wait wake walk wall want warm warn warp wash wave ways
weak wear weed week well went were west what when whom wide wife wild will wind
wine wing wink wipe wire wise wish with wolf wood wool word wore work worm worn
wrap yard yarn year yell yoga yoke your zeal zero zest zone
`.trim().toUpperCase().split(/\s+/);

export const BONUS_WORDS: ReadonlySet<string> = new Set(entries);
export const BONUS_WORD_COUNT = BONUS_WORDS.size;

const express = require("express");
const mongoose = require("mongoose");
const _ = require("lodash");
const { trim } = require("lodash");

// console.log(date()); // tady už závorky píšeme, protože se jakoby odkazujeme na funkci v jiném modulu před require v promenné date

const app = express();
port = 3000;

app.set('view engine', 'ejs');

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));

// vytvožení nové databáze v MongoDB → zadáváme URL adresu, kde je mongoDB lokálně hostované + /názevDB
// mongoose.connect("mongodb://127.0.0.1:27017/todolistDB") 
// místo localhost napiš 127.0.0.1

// Napojení nové DB z Mongo Atlas přes mongoose 
mongoose.connect("mongodb+srv://OndraS:bloody44@cluster0.lsbfvmo.mongodb.net/todolistDB");

//Create scheme 
const itemsSchema = new mongoose.Schema({
  name: String
});

// Create model/collection in MongoDB
const Item = mongoose.model("Item", itemsSchema);

// Create items base on Item model - this three items is default
const item1 = new Item({
  name: "Welcome to your todoList."
});
const item2 = new Item({
  name: "Hit the + button to add a new item."
});
const item3 = new Item({
  name: "← Hit checkbox to delete an item"
});

// create an array of pre-creat items which contains all items defined above
const defaultItems = [item1, item2, item3]

// vytváření proměnné pro tvorbu custom List - obsahuje name a array s itey podle itemsSchema 
const listSchema = new mongoose.Schema({
  name: String,
  items: [itemsSchema]
})

// vytvoření collection List na základě listSchema, ve které v podstatě ukládáme celý to Do List - je v ná jméno, i items
const List = mongoose.model("List", listSchema);

app.get("/", (req, res) => {
  // find items in DB
  Item.find({}) // nezadáváme conditions, protože chceme najít všechno
    .then((items) => {
      // zkontrolujeme zda je databáze prázdná
      if (items.length === 0) { // → pokud ano přidáme víše vytvoředé defaultItems (zajistíme tak aby se nám nepřidávaly pořád dokola)
        // insert new items to DB
        Item.insertMany(defaultItems).then(function () {
            console.log("Successfully saved default items to DB.");
          }).catch(function (err) {
            console.log(err);
          });
        res.redirect("/") // aby se nám nové hodnoty i renderovali, stačí jen přesměrovat na root a projít znovu podmínkou, která by tentokrát měla skončit na else
      }
      
      else { // → pokud je Db nějak naplněná, pouze renderujeme hodnoty do ejs
        res.render('list', { 
          listTitle: "Today",
          newListItems: items // do proměnné v ejs pak posíláme celý array → pokračování v list.ejs
        });
      }
    })
    .catch(function (err) {
      console.log(err);
    });
});

app.post("/", (req, res) => {
  // po odeslání form vytvoříme proměnné s výstupy a document item, kde name se rovná našemu vstupu req.body.newItem a listName se rovná req.body.list  
  const itemName = req.body.newItem;
  const listName = req.body.list; // změna formátování aby ve vyhledávání nebyla potíž s tím, že první písmeno je velké atd.

  const item = new Item({ 
    name: itemName
  })
  // podmínka na ověření toho na které stránce se nacházíme - ověřujeme to podle nadpisu stránky
  // pokud se listName = "Today" (string co je přehazovaný z app.get, kde je renderovaný jako heading a pak vložený jako value button a tím se pak dostane do listName) → přidáme tak item do route /
  if (listName === "Today") {
    item.save()
    // aby se nám zadaný item i verenderoval, musíme přesměrovat kód zpátky na home route "/", kde prohledáváme databázy a tím i nový item
    res.redirect("/")
  }
  // pokud se nerovná "Today", musíme najít v DB document co svým name odpovídá listName a item vložíme do jeho proměnné items
  else {
    List.findOne({name: listName}).then((foundList) => {  
      foundList.items.push(item); // protože proměnná items v sobě ukládá array všech items → použijeme push()
        foundList.save();
        res.redirect(`/${listName}`);
      }).catch((err) => {
        console.log(err)
      });
  }
});

app.post("/delete", (req,res) => {
  // z form kolem checkbox inputu posíláme value (tedy id itemu) a ukládáme do proměnné 
  const checkedItemId = req.body.checkbox;
  const checkedListName = req.body.listName; // proměnná vytažená z input hidden 

  // (Znovu) podmínka na kontrolu zda se znažíme vymazat item v home route nebo v custom route
  if (checkedListName === "Today"){
    Item.deleteMany({ _id: checkedItemId })
      .then(() => {
        console.log("Successfully deleted the item")
        res.redirect("/") // pro znovu vyrenderování seznamu se přesměrujeme na home route ("/")
      })
      .catch((err) => {
        console.log(err);
      });
  }
  else {
    // první parametr je query, kterým vybereme příslušný list v DB
    // druhý pramater je update → v našem případě do něj vkládáme metodu $pull, který vymaže ve zvoleném array item na základě query 
    List.findOneAndUpdate({name: checkedListName}, {$pull: {items: {_id: checkedItemId}}})
    .then((foundList) => {
      res.redirect(`/${checkedListName}`);
    }).catch((err) => {
      console.log(err);
    })
  }

  // z mongoose si pak zavoláme funkci na vymazaání záznamu z databáze a vložíme co query id vybraného itemu
  
});

// vytvoření custom stránky s to do Listem
app.get("/:customListName", (req,res) => {
  const customListName = _.upperFirst(req.params.customListName);
  // findOne() vrací object podle podmínky
  List.findOne({ name: customListName}).then((foundList) => { 
      // console.log(foundList) 
      if(!foundList) { // !foundList vrátí true pokud je undefined, neboli neexistuje v databázi
        // Name doesn't exit → Create a new list
        console.log("neexistuje")
        const list = new List({
          name: customListName,
          items: defaultItems
        });
        list.save();
        res.redirect(`/${customListName}`)
      }
      else{
        // Name exists → Show/Render an existing list
        res.render("list", {
          listTitle: foundList.name,
          newListItems: foundList.items
        })
      }
    })
    .catch((err) => {
      console.log(err)
    });

  

});

app.get("/about", (req,res) => {
  res.render("about");
})

app.listen(port, () => {
  console.log(`Server is running on port ${port}`)
});
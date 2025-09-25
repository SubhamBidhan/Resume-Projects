fetch("/navbar/navbar.html")
.then(response=>response.text())
.then(data=>{document.getElementById("navbar").innerHTML=data;

const menuIcon=document.getElementById("menuIcon");
const sidePanel=document.getElementById("sidePanel");

menuIcon.addEventListener("click",()=>{
    sidePanel.classList.toggle("active");
    menuIcon.classList.toggle("rotated");
});
}).catch(error => console.error("Error loading navbar:", error));;